import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { TokenManagerService } from './token-manager.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { REFRESH_TOKEN_TTL_SECONDS } from './constants/auth-cookie.constants.js';

describe('TokenManagerService', () => {
    let service: TokenManagerService;
    let mockJwtService: any;
    let mockConfigService: any;
    let mockRedisService: any;

    const mockUser = {
        id: 'user-uuid-1',
        username: 'alice',
        role: 'USER',
    };

    beforeEach(async () => {
        mockJwtService = {
            signAsync: vi.fn().mockResolvedValue('mock-access-token-jwt'),
        };

        mockConfigService = {
            get: vi.fn().mockImplementation((key: string) => {
                if (key === 'JWT_SECRET') return 'test-secret-key-123';
                return null;
            }),
        };

        mockRedisService = {
            get: vi.fn(),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            sadd: vi.fn().mockResolvedValue(1),
            smembers: vi.fn().mockResolvedValue([]),
            srem: vi.fn().mockResolvedValue(1),
            expire: vi.fn().mockResolvedValue(1),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenManagerService,
                { provide: JwtService, useValue: mockJwtService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: RedisService, useValue: mockRedisService },
            ],
        }).compile();

        service = module.get<TokenManagerService>(TokenManagerService);
    });

    describe('generateTokenPair', () => {
        it('should generate an Access Token and an opaque Refresh Token with family tracking', async () => {
            const result = await service.generateTokenPair(mockUser, 'chrome-desktop');

            expect(result).toHaveProperty('accessToken', 'mock-access-token-jwt');
            expect(result).toHaveProperty('refreshToken');
            expect(result).toHaveProperty('familyId');
            expect(result).toHaveProperty('deviceId', 'chrome-desktop');
            expect(result).toHaveProperty('jti');

            // Verify JWT signing
            expect(mockJwtService.signAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: mockUser.id,
                    username: mockUser.username,
                    role: mockUser.role,
                    jti: result.jti,
                }),
                expect.objectContaining({
                    expiresIn: 900, // 15 mins
                    secret: 'test-secret-key-123',
                }),
            );

            // Verify Refresh Token format: tokenId.secret
            const parsed = service.parseRawRefreshToken(result.refreshToken);
            expect(parsed).not.toBeNull();
            expect(parsed?.tokenId).toBeDefined();
            expect(parsed?.secret).toBeDefined();

            // Verify Redis calls
            expect(mockRedisService.set).toHaveBeenCalledWith(
                `auth:refresh:${mockUser.id}:${parsed?.tokenId}`,
                expect.any(String),
                REFRESH_TOKEN_TTL_SECONDS,
            );

            expect(mockRedisService.sadd).toHaveBeenCalledWith(
                `auth:family:${result.familyId}`,
                parsed?.tokenId,
            );

            expect(mockRedisService.expire).toHaveBeenCalledWith(
                `auth:family:${result.familyId}`,
                REFRESH_TOKEN_TTL_SECONDS,
            );

            expect(mockRedisService.sadd).toHaveBeenCalledWith(
                `auth:user_sessions:${mockUser.id}`,
                'chrome-desktop',
            );
        });

        it('should preserve existingFamilyId when provided (Token Rotation)', async () => {
            const existingFamilyId = 'existing-family-uuid';
            const result = await service.generateTokenPair(mockUser, 'mobile-app', existingFamilyId);

            expect(result.familyId).toBe(existingFamilyId);
            expect(mockRedisService.sadd).toHaveBeenCalledWith(
                `auth:family:${existingFamilyId}`,
                expect.any(String),
            );
        });
    });

    describe('parseRawRefreshToken', () => {
        it('should return null for invalid formats', () => {
            expect(service.parseRawRefreshToken('')).toBeNull();
            expect(service.parseRawRefreshToken('invalid-no-dot')).toBeNull();
            expect(service.parseRawRefreshToken('a.b.c')).toBeNull();
            expect(service.parseRawRefreshToken('.secret')).toBeNull();
            expect(service.parseRawRefreshToken('tokenId.')).toBeNull();
            expect(service.parseRawRefreshToken(undefined as any)).toBeNull();
        });

        it('should return tokenId and secret for valid format', () => {
            const parsed = service.parseRawRefreshToken('my-token-id.my-secret-value');
            expect(parsed).toEqual({
                tokenId: 'my-token-id',
                secret: 'my-secret-value',
            });
        });
    });

    describe('verifyRefreshTokenRecord', () => {
        it('should return null if token does not exist in Redis', async () => {
            mockRedisService.get.mockResolvedValue(null);

            const result = await service.verifyRefreshTokenRecord('user-1', 'token-1', 'secret-1');
            expect(result).toBeNull();
        });

        it('should return null if secret does not match hash (tampering)', async () => {
            const realHash = createHash('sha256').update('real-secret').digest('hex');
            mockRedisService.get.mockResolvedValue(
                JSON.stringify({
                    tokenId: 'token-1',
                    familyId: 'family-1',
                    userId: 'user-1',
                    tokenHash: realHash,
                }),
            );

            const result = await service.verifyRefreshTokenRecord('user-1', 'token-1', 'fake-secret');
            expect(result).toBeNull();
        });

        it('should return metadata when secret matches hash via timingSafeEqual', async () => {
            const secret = 'valid-super-secret';
            const realHash = createHash('sha256').update(secret).digest('hex');
            const storedRecord = {
                tokenId: 'token-1',
                familyId: 'family-1',
                userId: 'user-1',
                deviceId: 'laptop',
                tokenHash: realHash,
                createdAt: 1000,
                expiresAt: 2000,
            };

            mockRedisService.get.mockResolvedValue(JSON.stringify(storedRecord));

            const result = await service.verifyRefreshTokenRecord('user-1', 'token-1', secret);
            expect(result).toEqual(storedRecord);
        });
    });

    describe('revokeToken & revokeFamily', () => {
        it('should revoke individual token and remove from family', async () => {
            await service.revokeToken('user-1', 'token-1', 'family-1');

            expect(mockRedisService.del).toHaveBeenCalledWith('auth:refresh:user-1:token-1');
            expect(mockRedisService.srem).toHaveBeenCalledWith('auth:family:family-1', 'token-1');
        });

        it('should revoke entire family and delete all related tokens', async () => {
            mockRedisService.smembers.mockResolvedValue(['token-a', 'token-b']);

            await service.revokeFamily('family-1', 'user-1');

            expect(mockRedisService.del).toHaveBeenCalledWith(
                'auth:refresh:user-1:token-a',
                'auth:refresh:user-1:token-b',
            );
            expect(mockRedisService.del).toHaveBeenCalledWith('auth:family:family-1');
        });
    });
});
