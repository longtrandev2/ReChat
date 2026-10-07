import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { FriendsService } from './friends.service.js';
import { Friendship, FriendshipStatus } from './entities/friendship.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

describe('FriendsService', () => {
    let service: FriendsService;
    let mockFriendshipRepo: any;
    let mockUserRepo: any;

    beforeEach(async () => {
        mockFriendshipRepo = {
            findOne: vi.fn(),
            find: vi.fn(),
            findAndCount: vi.fn(),
            create: vi.fn((data) => data),
            save: vi.fn((data) =>
                Promise.resolve({
                    id: 'friendship-uuid-1',
                    createdAt: new Date('2026-10-06T00:00:00.000Z'),
                    ...data,
                }),
            ),
            delete: vi.fn().mockResolvedValue({ affected: 1 }),
        };

        mockUserRepo = {
            findOne: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FriendsService,
                {
                    provide: getRepositoryToken(Friendship),
                    useValue: mockFriendshipRepo,
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepo,
                },
            ],
        }).compile();

        service = module.get<FriendsService>(FriendsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ==========================================
    // 1. sendFriendRequest
    // ==========================================
    describe('sendFriendRequest', () => {
        const currentUserId = 'user-current-id';
        const targetUserId = 'user-target-id';

        it('should throw BadRequestException when current user tries to friend themselves (BR-03)', async () => {
            // Arrange: same user ID for sender and receiver
            const sameUserId = 'user-current-id';

            // Act & Assert
            await expect(
                service.sendFriendRequest(sameUserId, sameUserId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException when target user does not exist', async () => {
            // Arrange
            mockUserRepo.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(
                service.sendFriendRequest(currentUserId, targetUserId),
            ).rejects.toThrow(NotFoundException);
            expect(mockUserRepo.findOne).toHaveBeenCalledWith({
                where: { id: targetUserId },
            });
        });

        it('should throw ConflictException if the two users are already friends (status ACCEPTED)', async () => {
            // Arrange
            mockUserRepo.findOne.mockResolvedValue({ id: targetUserId });
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: 'existing-f-id',
                status: FriendshipStatus.ACCEPTED,
                requester: { id: currentUserId },
                addressee: { id: targetUserId },
            });

            // Act & Assert
            await expect(
                service.sendFriendRequest(currentUserId, targetUserId),
            ).rejects.toThrow(ConflictException);
        });

        it('should throw ConflictException if current user already sent a pending request', async () => {
            // Arrange
            mockUserRepo.findOne.mockResolvedValue({ id: targetUserId });
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: 'existing-f-id',
                status: FriendshipStatus.PENDING,
                requester: { id: currentUserId },
                addressee: { id: targetUserId },
            });

            // Act & Assert
            await expect(
                service.sendFriendRequest(currentUserId, targetUserId),
            ).rejects.toThrow(ConflictException);
        });

        it('should throw ConflictException if target user has already sent a pending request to current user', async () => {
            // Arrange
            mockUserRepo.findOne.mockResolvedValue({ id: targetUserId });
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: 'existing-f-id',
                status: FriendshipStatus.PENDING,
                requester: { id: targetUserId },
                addressee: { id: currentUserId },
            });

            // Act & Assert
            await expect(
                service.sendFriendRequest(currentUserId, targetUserId),
            ).rejects.toThrow(ConflictException);
        });

        it('should successfully create and return new pending friendship (Happy Path)', async () => {
            // Arrange
            const targetUser = { id: targetUserId, username: 'targetUser' };
            mockUserRepo.findOne.mockResolvedValue(targetUser);
            mockFriendshipRepo.findOne.mockResolvedValue(null);

            // Act
            const result = await service.sendFriendRequest(currentUserId, targetUserId);

            // Assert
            expect(result).toBeDefined();
            expect(result.status).toBe(FriendshipStatus.PENDING);
            expect(mockFriendshipRepo.create).toHaveBeenCalledWith({
                requester: { id: currentUserId },
                addressee: targetUser,
                status: FriendshipStatus.PENDING,
            });
            expect(mockFriendshipRepo.save).toHaveBeenCalled();
        });
    });

    // ==========================================
    // 2. acceptFriendRequest
    // ==========================================
    describe('acceptFriendRequest', () => {
        const currentUserId = 'user-addressee-id';
        const requestId = 'req-uuid-1';

        it('should throw NotFoundException if request does not exist', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(
                service.acceptFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if request status is not PENDING', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.ACCEPTED,
                addressee: { id: currentUserId },
                requester: { id: 'other-user' },
            });

            // Act & Assert
            await expect(
                service.acceptFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if current user is not the addressee', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.PENDING,
                addressee: { id: 'someone-else-id' },
                requester: { id: currentUserId },
            });

            // Act & Assert
            await expect(
                service.acceptFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should update status to ACCEPTED and save (Happy Path)', async () => {
            // Arrange
            const pendingRequest = {
                id: requestId,
                status: FriendshipStatus.PENDING,
                addressee: { id: currentUserId },
                requester: { id: 'user-requester-id' },
            };
            mockFriendshipRepo.findOne.mockResolvedValue(pendingRequest);

            // Act
            const result = await service.acceptFriendRequest(currentUserId, requestId);

            // Assert
            expect(result.status).toBe(FriendshipStatus.ACCEPTED);
            expect(mockFriendshipRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: requestId,
                    status: FriendshipStatus.ACCEPTED,
                }),
            );
        });
    });

    // ==========================================
    // 3. rejectFriendRequest
    // ==========================================
    describe('rejectFriendRequest', () => {
        const currentUserId = 'user-addressee-id';
        const requestId = 'req-uuid-1';

        it('should throw NotFoundException if request does not exist', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(
                service.rejectFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if request status is not PENDING', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.ACCEPTED,
                addressee: { id: currentUserId },
                requester: { id: 'user-other' },
            });

            // Act & Assert
            await expect(
                service.rejectFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if current user is not the addressee', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.PENDING,
                addressee: { id: 'another-user-id' },
                requester: { id: currentUserId },
            });

            // Act & Assert
            await expect(
                service.rejectFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should delete the request and return success message (Happy Path)', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.PENDING,
                addressee: { id: currentUserId },
                requester: { id: 'user-sender' },
            });

            // Act
            const result = await service.rejectFriendRequest(currentUserId, requestId);

            // Assert
            expect(mockFriendshipRepo.delete).toHaveBeenCalledWith(requestId);
            expect(result).toEqual({ message: 'Đã từ chối lời mời kết bạn' });
        });
    });

    // ==========================================
    // 4. cancelFriendRequest
    // ==========================================
    describe('cancelFriendRequest', () => {
        const currentUserId = 'user-requester-id';
        const requestId = 'req-uuid-1';

        it('should throw NotFoundException if request does not exist', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(
                service.cancelFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if request status is not PENDING', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.ACCEPTED,
                requester: { id: currentUserId },
                addressee: { id: 'user-target' },
            });

            // Act & Assert
            await expect(
                service.cancelFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if current user is not the requester', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.PENDING,
                requester: { id: 'other-requester' },
                addressee: { id: currentUserId },
            });

            // Act & Assert
            await expect(
                service.cancelFriendRequest(currentUserId, requestId),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should delete the request and return success message (Happy Path)', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: requestId,
                status: FriendshipStatus.PENDING,
                requester: { id: currentUserId },
                addressee: { id: 'user-target' },
            });

            // Act
            const result = await service.cancelFriendRequest(currentUserId, requestId);

            // Assert
            expect(mockFriendshipRepo.delete).toHaveBeenCalledWith(requestId);
            expect(result).toEqual({ message: 'Đã hủy chối lời mời kết bạn' });
        });
    });

    // ==========================================
    // 5. unfriend
    // ==========================================
    describe('unfriend', () => {
        const currentUserId = 'user-me';
        const friendId = 'user-friend';

        it('should throw NotFoundException if friendship does not exist (BR-13)', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(service.unfriend(currentUserId, friendId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should delete friendship and return success message (Happy Path)', async () => {
            // Arrange
            mockFriendshipRepo.findOne.mockResolvedValue({
                id: 'friendship-uuid-to-delete',
                status: FriendshipStatus.ACCEPTED,
            });

            // Act
            const result = await service.unfriend(currentUserId, friendId);

            // Assert
            expect(mockFriendshipRepo.delete).toHaveBeenCalledWith('friendship-uuid-to-delete');
            expect(result).toEqual({ message: 'Đã hủy kết bạn thành công' });
        });
    });

    // ==========================================
    // 6. getFriendList
    // ==========================================
    describe('getFriendList', () => {
        const currentUserId = 'user-me';

        it('should return paginated friend list and correctly flatten the friend object', async () => {
            // Arrange
            const query: PaginationQueryDto = { page: 1, limit: 10 };
            const mockFriendships = [
                // Case A: currentUserId is requester -> friend is addressee (user-bob)
                {
                    id: 'f-1',
                    createdAt: new Date('2026-10-01'),
                    requester: { id: currentUserId, username: 'me' },
                    addressee: {
                        id: 'user-bob',
                        username: 'bob',
                        displayName: 'Bob The Builder',
                        avatarUrl: 'https://example.com/bob.png',
                    },
                },
                // Case B: currentUserId is addressee -> friend is requester (user-alice)
                {
                    id: 'f-2',
                    createdAt: new Date('2026-10-02'),
                    requester: {
                        id: 'user-alice',
                        username: 'alice',
                        displayName: 'Alice Wonder',
                        avatarUrl: null,
                    },
                    addressee: { id: currentUserId, username: 'me' },
                },
            ];

            mockFriendshipRepo.findAndCount.mockResolvedValue([mockFriendships, 2]);

            // Act
            const result = await service.getFriendList(currentUserId, query);

            // Assert
            expect(result).toBeDefined();
            expect(result.data).toHaveLength(2);

            // Bob verification
            expect(result.data[0].id).toBe('user-bob');
            expect(result.data[0].username).toBe('bob');
            expect(result.data[0].friendshipId).toBe('f-1');

            // Alice verification
            expect(result.data[1].id).toBe('user-alice');
            expect(result.data[1].username).toBe('alice');
            expect(result.data[1].friendshipId).toBe('f-2');

            // Pagination metadata verification
            expect(result.meta).toEqual({
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
            });
        });

        it('should handle empty friend list and calculate pagination properly', async () => {
            // Arrange
            const query: PaginationQueryDto = { page: 2, limit: 5 };
            mockFriendshipRepo.findAndCount.mockResolvedValue([[], 0]);

            // Act
            const result = await service.getFriendList(currentUserId, query);

            // Assert
            expect(result.data).toEqual([]);
            expect(result.meta.total).toBe(0);
            expect(result.meta.totalPages).toBe(0);
            expect(result.meta.hasNextPage).toBe(false);
            expect(result.meta.hasPrevPage).toBe(true);
        });
    });

    // ==========================================
    // 7. getSentRequests
    // ==========================================
    describe('getSentRequests', () => {
        const currentUserId = 'user-me';

        it('should return pending requests sent by current user', async () => {
            // Arrange
            const mockRequests = [
                {
                    id: 'f-sent-1',
                    status: FriendshipStatus.PENDING,
                    createdAt: new Date(),
                    addressee: { id: 'target-1', username: 'charlie' },
                },
            ];
            mockFriendshipRepo.find.mockResolvedValue(mockRequests);

            // Act
            const result = await service.getSentRequests(currentUserId);

            // Assert
            expect(result).toEqual(mockRequests);
            expect(mockFriendshipRepo.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        requester: { id: currentUserId },
                        status: FriendshipStatus.PENDING,
                    },
                }),
            );
        });
    });

    // ==========================================
    // 8. getReceivedRequests
    // ==========================================
    describe('getReceivedRequests', () => {
        const currentUserId = 'user-me';

        it('should return pending requests received by current user', async () => {
            // Arrange
            const mockRequests = [
                {
                    id: 'f-recv-1',
                    status: FriendshipStatus.PENDING,
                    createdAt: new Date(),
                    requester: { id: 'sender-1', username: 'david' },
                },
            ];
            mockFriendshipRepo.find.mockResolvedValue(mockRequests);

            // Act
            const result = await service.getReceivedRequests(currentUserId);

            // Assert
            expect(result).toEqual(mockRequests);
            expect(mockFriendshipRepo.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        addressee: { id: currentUserId },
                        status: FriendshipStatus.PENDING,
                    },
                }),
            );
        });
    });
});
