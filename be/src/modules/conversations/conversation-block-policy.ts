import { ForbiddenException } from '@nestjs/common';
import { In, type Repository } from 'typeorm';
import { Friendship, FriendshipStatus } from '../friends/entities/friendship.entity.js';

/** Trạng thái chặn theo góc nhìn của người gọi (FR-29, BR-28, BR-38) */
export type BlockStatus = 'NONE' | 'BLOCKED_BY_ME' | 'BLOCKED_ME';

/**
 * Tra trạng thái chặn giữa `userId` và nhiều user khác chỉ bằng 1 query (2 chiều).
 * Friendship BLOCKED luôn có requester = người chặn, addressee = người bị chặn.
 */
export async function getBlockStatusMap(
    friendshipRepository: Repository<Friendship>,
    userId: string,
    otherIds: string[],
): Promise<Map<string, BlockStatus>> {
    const result = new Map<string, BlockStatus>();
    const ids = [...new Set(otherIds)].filter(Boolean);
    if (ids.length === 0) return result;

    const rows =
        (await friendshipRepository.find({
            where: [
                { requester: { id: userId }, addressee: { id: In(ids) }, status: FriendshipStatus.BLOCKED },
                { requester: { id: In(ids) }, addressee: { id: userId }, status: FriendshipStatus.BLOCKED },
            ],
            relations: { requester: true, addressee: true },
            select: { id: true, requester: { id: true }, addressee: { id: true } },
        })) || [];

    for (const row of rows) {
        if (row.requester.id === userId) {
            result.set(row.addressee.id, 'BLOCKED_BY_ME');
        } else if (!result.has(row.requester.id)) {
            result.set(row.requester.id, 'BLOCKED_ME');
        }
    }
    return result;
}

export async function getBlockStatus(
    friendshipRepository: Repository<Friendship>,
    userId: string,
    otherId: string,
): Promise<BlockStatus> {
    const map = await getBlockStatusMap(friendshipRepository, userId, [otherId]);
    return map.get(otherId) ?? 'NONE';
}

/** Lỗi 403 CONVERSATION_BLOCKED với thông điệp đúng vai trò (BR-38) */
export function buildConversationBlockedException(status: Exclude<BlockStatus, 'NONE'>): ForbiddenException {
    return new ForbiddenException({
        errorCode: 'CONVERSATION_BLOCKED',
        message: status === 'BLOCKED_BY_ME' ? 'Bạn đã chặn người dùng này' : 'Bạn không thể gửi tin nhắn cho người này',
    });
}
