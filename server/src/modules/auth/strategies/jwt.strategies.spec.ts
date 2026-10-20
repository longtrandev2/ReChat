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
    });
});
