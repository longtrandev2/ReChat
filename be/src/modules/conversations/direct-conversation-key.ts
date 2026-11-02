import type { Repository } from 'typeorm';
import { Conversation, ConversationType } from './entities/conversation.entity.js';

/**
 * Khóa duy nhất của hội thoại DIRECT giữa 2 user (BR-05): 2 userId sắp xếp tăng dần, nối bằng ':'.
 * Thứ tự không phụ thuộc người gọi nên (A,B) và (B,A) cho cùng một khóa.
 */
export function buildDirectKey(userIdA: string, userIdB: string): string {
    return [userIdA, userIdB].sort().join(':');
}

/** Lỗi trùng khóa unique của MySQL (ER_DUP_ENTRY / errno 1062), kể cả khi bị TypeORM bọc trong QueryFailedError */
export function isDuplicateKeyError(error: unknown): boolean {
    const e = error as { code?: string; errno?: number; driverError?: { code?: string; errno?: number } } | null;
    const code = e?.code ?? e?.driverError?.code;
    const errno = e?.errno ?? e?.driverError?.errno;
    return code === 'ER_DUP_ENTRY' || errno === 1062;
}

/**
 * Tìm hội thoại DIRECT giữa 2 user: tra theo directKey trước (nhanh, có unique index),
 * không có thì fallback truy vấn theo thành viên cho các bản ghi cũ chưa có directKey.
 */
export async function findDirectConversation(
    conversationRepository: Repository<Conversation>,
    userIdA: string,
    userIdB: string,
): Promise<Conversation | null> {
    const byKey = await conversationRepository.findOne({
        where: { directKey: buildDirectKey(userIdA, userIdB) },
    });
    if (byKey) return byKey;

    return conversationRepository
        .createQueryBuilder('c')
        .innerJoin('c.members', 'm1')
        .innerJoin('c.members', 'm2')
        .where('c.type = :type', { type: ConversationType.DIRECT })
        .andWhere('m1.userId = :userIdA', { userIdA })
        .andWhere('m2.userId = :userIdB', { userIdB })
        .getOne();
}
