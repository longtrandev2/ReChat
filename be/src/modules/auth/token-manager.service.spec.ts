import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { TokenManagerService } from './token-manager.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { REFRESH_TOKEN_GRACE_PERIOD_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './constants/auth-cookie.constants.js';

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

            // Verify Redis calls (Direct O(1) key without userId in key name)
            expect(mockRedisService.set).toHaveBeenCalledWith(
                `auth:refresh:${parsed?.tokenId}`,
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

            const result = await service.verifyRefreshTokenRecord('token-1', 'secret-1');
            expect(result).toBeNull();
        });

        it('should return null if secret does not match hash (tampering)', async () => {
            const realHash = createHash('sha256').update('real-secret').digest('hex');
            mockRedisService.get.mockResolvedValue(
                JSON.stringify({
                    tokenId: 'token-1',
                    familyId: 'family-1',
                    userId: 'user-1',
                    username: 'alice',
                    tokenHash: realHash,
                }),
            );

            const result = await service.verifyRefreshTokenRecord('token-1', 'fake-secret');
            expect(result).toBeNull();
        });

        it('should return metadata when secret matches hash via timingSafeEqual', async () => {
            const secret = 'valid-super-secret';
            const realHash = createHash('sha256').update(secret).digest('hex');
            const storedRecord = {
                tokenId: 'token-1',
                familyId: 'family-1',
                userId: 'user-1',
                username: 'alice',
                deviceId: 'laptop',
                tokenHash: realHash,
                createdAt: 1000,
                expiresAt: 2000,
            };

            mockRedisService.get.mockResolvedValue(JSON.stringify(storedRecord));

            const result = await service.verifyRefreshTokenRecord('token-1', secret);
            expect(result).toEqual(storedRecord);
        });
    });

    describe('rotateRefreshToken (RTR + 30s Grace Period + Token Theft)', () => {
        it('should throw UnauthorizedException if token string is invalid', async () => {
            await expect(service.rotateRefreshToken('')).rejects.toThrow(UnauthorizedException);
            await expect(service.rotateRefreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
        });

        it('should return cached new token pair if request is within 30s Grace Period (Multi-tab concurrency)', async () => {
            const cachedPair = {
                accessToken: 'grace-access-token',
                refreshToken: 'new-token-id.secret',
                familyId: 'family-1',
                deviceId: 'tab-1',
                jti: 'jti-1',
                userId: 'user-uuid-1',
            };

            mockRedisService.get.mockImplementation(async (key: string) => {
                if (key === 'auth:grace:old-token-id') {
                    return JSON.stringify(cachedPair);
                }
                return null;
            });

            const result = await service.rotateRefreshToken('old-token-id.any-secret');
            expect(result).toEqual(cachedPair);
            // Must NOT call signAsync again
            expect(mockJwtService.signAsync).not.toHaveBeenCalled();
        });

        it('should successfully rotate token, record in grace period, and record in invalidated tracker', async () => {
            const oldSecret = 'old-secret-123';
            const oldHash = createHash('sha256').update(oldSecret).digest('hex');
            const activeRecord = {
                tokenId: 'old-token-id',
                familyId: 'family-uuid',
                userId: 'user-1',
                username: 'alice',
                role: 'USER',
                deviceId: 'desktop-chrome',
                tokenHash: oldHash,
                createdAt: Date.now(),
                expiresAt: Date.now() + 10000,
            };

            mockRedisService.get.mockImplementation(async (key: string) => {
                if (key === 'auth:refresh:old-token-id') {
                    return JSON.stringify(activeRecord);
                }
                return null;
            });

            const result = await service.rotateRefreshToken(`old-token-id.${oldSecret}`, 'desktop-chrome');

            expect(result).toBeDefined();
            expect(result.familyId).toBe('family-uuid');
            expect(result.accessToken).toBe('mock-access-token-jwt');

            // Old token deleted from active refresh pool
            expect(mockRedisService.del).toHaveBeenCalledWith('auth:refresh:old-token-id');
            expect(mockRedisService.srem).toHaveBeenCalledWith('auth:family:family-uuid', 'old-token-id');

            // Stored in 30s grace period
            expect(mockRedisService.set).toHaveBeenCalledWith(
                'auth:grace:old-token-id',
                expect.any(String),
                REFRESH_TOKEN_GRACE_PERIOD_SECONDS,
            );

            // Stored in 30d invalidated tracker for reuse detection
            expect(mockRedisService.set).toHaveBeenCalledWith(
                'auth:invalidated:old-token-id',
                'family-uuid',
                REFRESH_TOKEN_TTL_SECONDS,
            );
        });

        it('should throw UnauthorizedException if deviceId does not match record deviceId (Device Binding mismatch)', async () => {
            const oldSecret = 'old-secret-123';
            const oldHash = createHash('sha256').update(oldSecret).digest('hex');
            const activeRecord = {
                tokenId: 'token-dev-a',
                familyId: 'family-dev-a',
                userId: 'user-1',
                username: 'alice',
                deviceId: 'device-a-uuid',
                tokenHash: oldHash,
                createdAt: Date.now(),
                expiresAt: Date.now() + 10000,
            };

            mockRedisService.get.mockImplementation(async (key: string) => {
                if (key === 'auth:refresh:token-dev-a') {
                    return JSON.stringify(activeRecord);
                }
                return null;
            });

            await expect(
                service.rotateRefreshToken(`token-dev-a.${oldSecret}`, 'device-b-uuid-stolen'),
            ).rejects.toThrow('Phiên đăng nhập không thuộc thiết bị này');
        });

        it('should detect Token Theft and revoke entire family when old rotated token is reused outside grace period', async () => {
            mockRedisService.get.mockImplementation(async (key: string) => {
                // Not in grace period
                if (key === 'auth:grace:stolen-token-id') return null;
                // Not in active refresh pool
                if (key === 'auth:refresh:stolen-token-id') return null;
                // BUT found in invalidated tracker!
                if (key === 'auth:invalidated:stolen-token-id') return 'compromised-family-uuid';
                return null;
            });

            mockRedisService.smembers.mockResolvedValue(['token-active-1', 'token-active-2']);

            await expect(
                service.rotateRefreshToken('stolen-token-id.any-secret'),
            ).rejects.toThrow(ForbiddenException);

            // Verify entire family is revoked
            expect(mockRedisService.del).toHaveBeenCalledWith(
                'auth:refresh:token-active-1',
                'auth:refresh:token-active-2',
            );
            expect(mockRedisService.del).toHaveBeenCalledWith('auth:family:compromised-family-uuid');
        });

        it('should throw UnauthorizedException when token does not exist anywhere', async () => {
            mockRedisService.get.mockResolvedValue(null);

            await expect(
                service.rotateRefreshToken('non-existent.secret'),
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('revokeToken & revokeFamily', () => {
        it('should revoke individual token and remove from family', async () => {
            await service.revokeToken('token-1', 'family-1');

            expect(mockRedisService.del).toHaveBeenCalledWith('auth:refresh:token-1');
            expect(mockRedisService.srem).toHaveBeenCalledWith('auth:family:family-1', 'token-1');
        });

        it('should revoke entire family and delete all related tokens', async () => {
            mockRedisService.smembers.mockResolvedValue(['token-a', 'token-b']);

            await service.revokeFamily('family-1');

            expect(mockRedisService.del).toHaveBeenCalledWith(
                'auth:refresh:token-a',
                'auth:refresh:token-b',
            );
            expect(mockRedisService.del).toHaveBeenCalledWith('auth:family:family-1');
        });
    });
});
