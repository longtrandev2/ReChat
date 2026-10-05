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
});
