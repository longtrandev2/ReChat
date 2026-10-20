import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './user.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
    let service: UsersService;
    let mockUserRepository: any;

    beforeEach(async () => {
        mockUserRepository = {
            findOne: vi.fn(),
            save: vi.fn(),
            createQueryBuilder: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findById', () => {
        it('should return user without password if user is found', async () => {
            mockUserRepository.findOne.mockResolvedValue({
                id: 'uuid-1',
                username: 'alice',
                password: 'secretpassword',
                displayName: 'Alice',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await service.findById('uuid-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('uuid-1');
            expect(result.username).toBe('alice');
            expect((result as any).password).toBeUndefined();
        });

        it('should throw NotFoundException if user is not found', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);

            await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findByUsername', () => {
        it('should return user by username', async () => {
            const user = { id: 'uuid-1', username: 'alice' } as User;
            mockUserRepository.findOne.mockResolvedValue(user);

            const result = await service.findByUsername('alice');
            expect(result).toEqual(user);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { username: 'alice' } });
        });
    });

    describe('updateProfile', () => {
        it('should update displayName and avatarUrl and return user without password', async () => {
            const existingUser = {
                id: 'uuid-1',
                username: 'alice',
                password: 'hash',
                displayName: 'Old Name',
                avatarUrl: 'old-url',
            } as User;

            mockUserRepository.findOne.mockResolvedValue(existingUser);
            mockUserRepository.save.mockImplementation((u: User) => Promise.resolve(u));

            const result = await service.updateProfile('uuid-1', {
                displayName: ' Alice New ',
                avatarUrl: 'https://new-avatar.png ',
            });

            expect(result.displayName).toBe('Alice New');
            expect(result.avatarUrl).toBe('https://new-avatar.png');
            expect((result as any).password).toBeUndefined();
            expect(mockUserRepository.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException if user to update does not exist', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);

            await expect(
                service.updateProfile('uuid-missing', { displayName: 'New' }),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('searchUsers', () => {
        it('should search users excluding current user and return without passwords', async () => {
            const mockQb = {
                where: vi.fn().mockReturnThis(),
                andWhere: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                take: vi.fn().mockReturnThis(),
                getMany: vi.fn().mockResolvedValue([
                    {
                        id: 'uuid-2',
                        username: 'bob',
                        displayName: 'Bob Trần',
                        password: 'hash',
                        avatarUrl: 'avatar.png',
                    },
                ]),
            };

            mockUserRepository.createQueryBuilder.mockReturnValue(mockQb);

            const results = await service.searchUsers('uuid-1', 'bob', 10);

            expect(results).toHaveLength(1);
            expect(results[0].username).toBe('bob');
            expect((results[0] as any).password).toBeUndefined();
            expect(mockQb.where).toHaveBeenCalledWith('user.id != :currentUserId', {
                currentUserId: 'uuid-1',
            });
            expect(mockQb.take).toHaveBeenCalledWith(10);
        });
    });

    describe('getPublicProfile', () => {
        it('should return public profile for target user', async () => {
            mockUserRepository.findOne.mockResolvedValue({
                id: 'uuid-target',
                username: 'charlie',
                displayName: 'Charlie',
                password: 'hash',
                isOnline: true,
                lastSeen: null,
            });

            const result = await service.getPublicProfile('uuid-target');
            expect(result.id).toBe('uuid-target');
            expect(result.username).toBe('charlie');
            expect((result as any).password).toBeUndefined();
        });
    });
});
