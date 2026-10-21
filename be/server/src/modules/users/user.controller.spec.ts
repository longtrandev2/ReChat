import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './user.controller.js';
import { UsersService } from './user.service.js';
import { User } from './entities/user.entity.js';

describe('UsersController', () => {
    let controller: UsersController;
    let mockUsersService: any;

    beforeEach(async () => {
        mockUsersService = {
            updateProfile: vi.fn(),
            searchUsers: vi.fn(),
            getPublicProfile: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
            ],
        }).compile();

        controller = module.get<UsersController>(UsersController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('updateProfile', () => {
        it('should call usersService.updateProfile with current user id and dto', async () => {
            const user = { id: 'user-1' } as User;
            const dto = { displayName: 'Alex Pro' };
            mockUsersService.updateProfile.mockResolvedValue({ id: 'user-1', displayName: 'Alex Pro' });

            const result = await controller.updateProfile(user, dto);
            expect(result).toEqual({ id: 'user-1', displayName: 'Alex Pro' });
            expect(mockUsersService.updateProfile).toHaveBeenCalledWith('user-1', dto);
        });
    });

    describe('searchUsers', () => {
        it('should call usersService.searchUsers with current user id, keyword and limit', async () => {
            const user = { id: 'user-1' } as User;
            mockUsersService.searchUsers.mockResolvedValue([{ id: 'user-2', username: 'bob' }]);

            const result = await controller.searchUsers(user, { q: 'bob', limit: 15 });
            expect(result).toHaveLength(1);
            expect(mockUsersService.searchUsers).toHaveBeenCalledWith('user-1', 'bob', 15);
        });
    });

    describe('getPublicProfile', () => {
        it('should call usersService.getPublicProfile with target id', async () => {
            mockUsersService.getPublicProfile.mockResolvedValue({ id: 'user-2', username: 'bob' });

            const result = await controller.getPublicProfile('user-2');
            expect(result).toEqual({ id: 'user-2', username: 'bob' });
            expect(mockUsersService.getPublicProfile).toHaveBeenCalledWith('user-2');
        });
    });
});
