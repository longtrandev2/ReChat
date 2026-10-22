import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Friendship, FriendshipStatus } from './entities/friendship.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PaginationQueryDto, PaginatedResponse } from '../../common/dto/pagination.dto.js';
import {
    FriendRequestSentEvent,
    FriendRequestAcceptedEvent,
    FriendRequestRejectedEvent,
    FriendRequestCancelledEvent,
    FriendRemovedEvent,
} from '../../common/events/index.js';

@Injectable()
export class FriendsService {
    constructor(
        @InjectRepository(Friendship)
        private readonly friendshipRepository: Repository<Friendship>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Gửi lời mời kết bạn từ currentUserId tới targetUserId (BR-03, BR-04)
     */
    async sendFriendRequest(currentUserId: string, targetUserId: string): Promise<Friendship> {
        // 1. Không tự gửi lời mời kết bạn cho chính mình (BR-03)
        if (currentUserId === targetUserId) {
            throw new BadRequestException('Không thể gửi lời mời kết bạn cho chính mình');
        }

        // 2. Kiểm tra người nhận có tồn tại hay không
        const targetUser = await this.userRepository.findOne({
            where: { id: targetUserId },
        });
        if (!targetUser) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        // 3. Kiểm tra quan hệ 2 chiều hiện tại giữa 2 người (BR-04)
        const existing = await this.friendshipRepository.findOne({
            where: [
                { requester: { id: currentUserId }, addressee: { id: targetUserId } },
                { requester: { id: targetUserId }, addressee: { id: currentUserId } },
            ],
            relations: {
                requester: true,
                addressee: true,
            },
        });

        if (existing) {
            if (existing.status === FriendshipStatus.ACCEPTED) {
                throw new ConflictException('Hai người đã là bạn bè');
            }
            if (existing.status === FriendshipStatus.PENDING) {
                if (existing.requester.id === currentUserId) {
                    throw new ConflictException('Bạn đã gửi lời mời kết bạn trước đó rồi');
                } else {
                    throw new ConflictException('Người này đã gửi lời mời cho bạn, vui lòng phản hồi lời mời');
                }
            }
        }

        // 4. Tạo mới và lưu bản ghi lời mời
        const newFriendship = this.friendshipRepository.create({
            requester: { id: currentUserId } as User,
            addressee: targetUser,
            status: FriendshipStatus.PENDING,
        });

        const saved = await this.friendshipRepository.save(newFriendship);

        // 5. Lấy thông tin requester để phát domain event realtime
        const requester = await this.userRepository.findOne({
            where: { id: currentUserId },
            select: { id: true, username: true, displayName: true, avatarUrl: true },
        });

        if (requester) {
            this.eventEmitter.emit(
                'friend.request_sent',
                new FriendRequestSentEvent(
                    saved.id,
                    {
                        id: requester.id,
                        username: requester.username,
                        displayName: requester.displayName || requester.username,
                        avatarUrl: requester.avatarUrl,
                    },
                    targetUserId,
                    saved.createdAt,
                ),
            );
        }

        return saved;
    }

    async acceptFriendRequest(currentUserId: string, requestId: string) {
        const friendship = await this.findPendingRequest(requestId);

        if (friendship.addressee.id !== currentUserId)
            throw new ForbiddenException('Bạn không có quyền chấp nhận lời mời kết bạn này')

        friendship.status = FriendshipStatus.ACCEPTED;
        const saved = await this.friendshipRepository.save(friendship);

        // Bắn domain event báo cho người gửi lời mời ban đầu (requester)
        this.eventEmitter.emit(
            'friend.request_accepted',
            new FriendRequestAcceptedEvent(
                saved.id,
                friendship.requester.id,
                {
                    id: friendship.addressee.id,
                    username: friendship.addressee.username,
                    displayName: friendship.addressee.displayName || friendship.addressee.username,
                    avatarUrl: friendship.addressee.avatarUrl,
                    isOnline: friendship.addressee.isOnline,
                },
                new Date(),
            ),
        );

        return saved;
    }

    async rejectFriendRequest(currentUserId: string, requestId: string) {
        const friendship = await this.findPendingRequest(requestId);

        if (friendship.addressee.id !== currentUserId)
            throw new ForbiddenException('Bạn không có quyền từ chối lời mời kết bạn này')

        await this.friendshipRepository.delete(requestId);

        // Bắn domain event báo cho requester biết lời mời bị từ chối
        this.eventEmitter.emit(
            'friend.request_rejected',
            new FriendRequestRejectedEvent(requestId, friendship.requester.id),
        );

        return { message: 'Đã từ chối lời mời kết bạn' }
    }

    async cancelFriendRequest(currentUserId: string, requestId: string) {
        const friendship = await this.findPendingRequest(requestId);

        if (friendship.requester.id !== currentUserId)
            throw new ForbiddenException('Bạn không có quyền từ chối lời mời kết bạn này')

        await this.friendshipRepository.delete(requestId);

        // Bắn domain event báo cho addressee biết lời mời đã bị hủy
        this.eventEmitter.emit(
            'friend.request_cancelled',
            new FriendRequestCancelledEvent(requestId, friendship.addressee.id),
        );

        return { message: 'Đã hủy chối lời mời kết bạn' }
    }


    private async findPendingRequest(requestId: string): Promise<Friendship> {
        const friendship = await this.friendshipRepository.findOne({
            where: { id: requestId },
            relations: {
                requester: true,
                addressee: true
            }
        })
        if (!friendship)
            throw new NotFoundException('Lời mời kết bạn không tồn tại')

        if (friendship.status !== FriendshipStatus.PENDING)
            throw new BadRequestException('Lời mời kết bạn không ở trạng thái chờ duyệt')

        return friendship;
    }

    async unfriend(currentUserId: string, friendId: string) {
        const friendship = await this.friendshipRepository.findOne({
            where: [
                { requester: { id: currentUserId }, addressee: { id: friendId }, status: FriendshipStatus.ACCEPTED },
                { requester: { id: friendId }, addressee: { id: currentUserId }, status: FriendshipStatus.ACCEPTED }
            ]
        })
        if (!friendship)
            throw new NotFoundException('Hai người không phải bạn bè')

        await this.friendshipRepository.delete(friendship.id);

        // Bắn domain event báo cho cả 2 phía về việc hủy kết bạn
        this.eventEmitter.emit(
            'friend.removed',
            new FriendRemovedEvent(currentUserId, friendId),
        );

        return { message: 'Đã hủy kết bạn thành công' }
    }

    async getFriendList(
        currentUserId: string,
        query: PaginationQueryDto = new PaginationQueryDto(),
    ): Promise<PaginatedResponse<any>> {
        const { page, limit } = query;
        const skip = (page - 1) * limit;

        const [friendships, total] = await this.friendshipRepository.findAndCount({
            where: [
                { requester: { id: currentUserId }, status: FriendshipStatus.ACCEPTED },
                { addressee: { id: currentUserId }, status: FriendshipStatus.ACCEPTED },
            ],
            relations: {
                requester: true,
                addressee: true,
            },
            select: {
                id: true,
                createdAt: true,
                requester: { id: true, username: true, displayName: true, avatarUrl: true },
                addressee: { id: true, username: true, displayName: true, avatarUrl: true },
            },
            order: {
                createdAt: 'DESC',
            },
            skip,
            take: limit,
        });

        // Làm phẳng dữ liệu: trích xuất thông tin người bạn
        const friends = friendships.map((f) => {
            const friend = f.requester.id === currentUserId ? f.addressee : f.requester;
            return {
                ...friend,
                friendshipId: f.id,
                becameFriendsAt: f.createdAt,
            };
        });

        return {
            data: friends,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        };
    }

    async getSentRequests(currentUserId: string) {
        const friendships = await this.friendshipRepository.find({
            where: {
                requester: { id: currentUserId },
                status: FriendshipStatus.PENDING
            },
            relations: {
                addressee: true,
            },
            order: {
                createdAt: 'DESC',
            },
            select: {
                id: true,
                status: true,
                createdAt: true,
                addressee: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true
                }
            }
        })

        return friendships;

    }

    async getReceivedRequests(currentUserId: string) {
        const friendships = await this.friendshipRepository.find({
            where: {
                addressee: { id: currentUserId },
                status: FriendshipStatus.PENDING
            },
            relations: {
                requester: true,
            },
            order: {
                createdAt: 'DESC',
            },
            select: {
                id: true,
                status: true,
                createdAt: true,
                requester: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true
                }
            }
        })

        return friendships;
    }
}
