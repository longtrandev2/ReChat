import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';
import { User } from '../users/entities/user.entity.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

describe('FriendsController', () => {
    let controller: FriendsController;
    let mockFriendsService: any;

    const mockCurrentUser = {
        id: 'current-user-uuid',
        username: 'currentUser',
    } as User;

    beforeEach(async () => {
        mockFriendsService = {
            sendFriendRequest: vi.fn(),
            getReceivedRequests: vi.fn(),
            getSentRequests: vi.fn(),
            acceptFriendRequest: vi.fn(),
            rejectFriendRequest: vi.fn(),
            cancelFriendRequest: vi.fn(),
            getFriendList: vi.fn(),
            unfriend: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [FriendsController],
            providers: [
                {
                    provide: FriendsService,
                    useValue: mockFriendsService,
                },
            ],
        }).compile();

        controller = module.get<FriendsController>(FriendsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ==========================================
    // 1. sendFriendRequest
    // ==========================================
    describe('sendFriendRequest', () => {
        it('should delegate to friendsService.sendFriendRequest and return result', async () => {
            // Arrange
            const targetUserId = 'target-user-uuid';
            const mockResponse = { id: 'req-1', status: 'PENDING' };
            mockFriendsService.sendFriendRequest.mockResolvedValue(mockResponse);

            // Act
            const result = await controller.sendFriendRequest(mockCurrentUser, targetUserId);

            // Assert
            expect(mockFriendsService.sendFriendRequest).toHaveBeenCalledWith(
                mockCurrentUser.id,
                targetUserId,
            );
            expect(result).toEqual(mockResponse);
        });
    });

    // ==========================================
    // 2. getReceivedRequests
    // ==========================================
    describe('getReceivedRequests', () => {
        it('should delegate to friendsService.getReceivedRequests and return result', async () => {
            // Arrange
            const mockList = [{ id: 'req-recv-1' }];
            mockFriendsService.getReceivedRequests.mockResolvedValue(mockList);

            // Act
            const result = await controller.getReceivedRequests(mockCurrentUser);

            // Assert
            expect(mockFriendsService.getReceivedRequests).toHaveBeenCalledWith(
                mockCurrentUser.id,
            );
            expect(result).toEqual(mockList);
        });
    });

    // ==========================================
    // 3. getSentRequests
    // ==========================================
    describe('getSentRequests', () => {
        it('should delegate to friendsService.getSentRequests and return result', async () => {
            // Arrange
            const mockList = [{ id: 'req-sent-1' }];
            mockFriendsService.getSentRequests.mockResolvedValue(mockList);

            // Act
            const result = await controller.getSentRequests(mockCurrentUser);

            // Assert
            expect(mockFriendsService.getSentRequests).toHaveBeenCalledWith(
                mockCurrentUser.id,
            );
            expect(result).toEqual(mockList);
        });
    });

    // ==========================================
    // 4. acceptFriendRequest
    // ==========================================
    describe('acceptFriendRequest', () => {
        it('should delegate to friendsService.acceptFriendRequest and return result', async () => {
            // Arrange
            const requestId = 'request-uuid-1';
            const mockResponse = { id: requestId, status: 'ACCEPTED' };
            mockFriendsService.acceptFriendRequest.mockResolvedValue(mockResponse);

            // Act
            const result = await controller.acceptFriendRequest(mockCurrentUser, requestId);

            // Assert
            expect(mockFriendsService.acceptFriendRequest).toHaveBeenCalledWith(
                mockCurrentUser.id,
                requestId,
            );
            expect(result).toEqual(mockResponse);
        });
    });

    // ==========================================
    // 5. rejectFriendRequest
    // ==========================================
    describe('rejectFriendRequest', () => {
        it('should delegate to friendsService.rejectFriendRequest and return result', async () => {
            // Arrange
            const requestId = 'request-uuid-1';
            const mockResponse = { message: 'Đã từ chối lời mời kết bạn' };
            mockFriendsService.rejectFriendRequest.mockResolvedValue(mockResponse);

            // Act
            const result = await controller.rejectFriendRequest(mockCurrentUser, requestId);

            // Assert
            expect(mockFriendsService.rejectFriendRequest).toHaveBeenCalledWith(
                mockCurrentUser.id,
                requestId,
            );
            expect(result).toEqual(mockResponse);
        });
    });

    // ==========================================
    // 6. cancelFriendRequest
    // ==========================================
    describe('cancelFriendRequest', () => {
        it('should delegate to friendsService.cancelFriendRequest and return result', async () => {
            // Arrange
            const requestId = 'request-uuid-1';
            const mockResponse = { message: 'Đã thu hồi lời mời kết bạn' };
            mockFriendsService.cancelFriendRequest.mockResolvedValue(mockResponse);

            // Act
            const result = await controller.cancelFriendRequest(mockCurrentUser, requestId);

            // Assert
            expect(mockFriendsService.cancelFriendRequest).toHaveBeenCalledWith(
                mockCurrentUser.id,
                requestId,
            );
            expect(result).toEqual(mockResponse);
        });
    });

    // ==========================================
    // 7. getFriendList
    // ==========================================
    describe('getFriendList', () => {
        it('should delegate to friendsService.getFriendList with pagination query', async () => {
            // Arrange
            const query: PaginationQueryDto = { page: 1, limit: 10 };
            const mockPaginated = {
                data: [{ id: 'friend-1', username: 'bob' }],
                meta: {
                    page: 1,
                    limit: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false,
                },
            };
            mockFriendsService.getFriendList.mockResolvedValue(mockPaginated);

            // Act
            const result = await controller.getFriendList(mockCurrentUser, query);

            // Assert
            expect(mockFriendsService.getFriendList).toHaveBeenCalledWith(
                mockCurrentUser.id,
                query,
            );
            expect(result).toEqual(mockPaginated);
        });
    });

    // ==========================================
    // 8. unfriend
    // ==========================================
    describe('unfriend', () => {
        it('should delegate to friendsService.unfriend and return result', async () => {
            // Arrange
            const friendId = 'friend-uuid-to-delete';
            const mockResponse = { message: 'Đã hủy kết bạn thành công' };
            mockFriendsService.unfriend.mockResolvedValue(mockResponse);

            // Act
            const result = await controller.unfriend(mockCurrentUser, friendId);

            // Assert
            expect(mockFriendsService.unfriend).toHaveBeenCalledWith(
                mockCurrentUser.id,
                friendId,
            );
            expect(result).toEqual(mockResponse);
        });
    });
});
