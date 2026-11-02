import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategies.js';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;
    let mockUserRepository: any;
    let mockConfigService: any;
    let mockRedisService: any;

    beforeEach(() => {
        mockUserRepository = {
            findOne: vi.fn(),
        };

        mockConfigService = {
            get: vi.fn().mockReturnValue('test-secret'),
        };

        mockRedisService = {
            isTokenBlacklisted: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue(null),
        };

        strategy = new JwtStrategy(mockUserRepository, mockConfigService, mockRedisService);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    describe('validate', () => {
        it('should return user without password if user is found', async () => {
            const mockUser = {
                id: 'user-uuid',
                username: 'alice',
                password: 'hashedpassword',
                displayName: 'Alice',
                avatarUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.findOne.mockResolvedValue(mockUser);

            const result = await strategy.validate({ sub: 'user-uuid', username: 'alice' });

            expect(result).toBeDefined();
            expect(result.id).toBe('user-uuid');
            expect(result.username).toBe('alice');
            expect((result as any).password).toBeUndefined();
        });

        it('should throw UnauthorizedException if user is not found', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);

            await expect(strategy.validate({ sub: 'non-existent', username: 'ghost' })).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException if token is blacklisted in Redis', async () => {
            mockRedisService.isTokenBlacklisted.mockResolvedValue(true);
            const mockReq = {
                headers: {
                    authorization: 'Bearer blacklisted-token-xyz',
                },
            };

            await expect(
                strategy.validate(mockReq, { sub: 'user-uuid', username: 'alice' }),
            ).rejects.toThrow(UnauthorizedException);
            expect(mockRedisService.isTokenBlacklisted).toHaveBeenCalledWith('blacklisted-token-xyz');
        });

        it('should throw UnauthorizedException if JTI is blacklisted', async () => {
            mockRedisService.isTokenBlacklisted.mockImplementation(async (key: string) => key === 'jti-revoked-123');

            await expect(
                strategy.validate({}, { sub: 'user-uuid', username: 'alice', jti: 'jti-revoked-123' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if token iat is before user_min_issued_at', async () => {
            mockRedisService.get.mockImplementation(async (key: string) => {
                if (key === 'auth:user_min_issued_at:user-uuid') return '1700000500000'; // 500s later
                return null;
            });

            await expect(
                strategy.validate({}, { sub: 'user-uuid', username: 'alice', iat: 1700000000 }), // 0s
            ).rejects.toThrow(UnauthorizedException);
        });
    });
});
