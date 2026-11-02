import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationMember } from './entities/conversation-member.entity.js';
import { ConversationsService } from './conversations.service.js';

/** Số cuộc trò chuyện tối đa mỗi người được ghim trong Inbox (FR-48) */
export const MAX_PINNED_CONVERSATIONS = 5;

/**
 * Menu tùy chọn cuộc hội thoại (FR-48): Ghim cuộc trò chuyện, Xóa đoạn chat.
 * Cả hai chỉ tác động lên bản ghi ConversationMember của CHÍNH người gọi (per-user), không ảnh hưởng thành viên khác.
 */
@Injectable()
export class ConversationActionsService {
    constructor(
        @InjectRepository(ConversationMember)
        private readonly memberRepository: Repository<ConversationMember>,
        private readonly conversationsService: ConversationsService,
    ) { }

    /**
     * Ghim / bỏ ghim cuộc trò chuyện trong Inbox của riêng người dùng (FR-48, BR-08)
     */
    async setPinned(
        currentUserId: string,
        conversationId: string,
        isPinned: boolean,
    ): Promise<{ conversationId: string; isPinned: boolean; pinnedAt: Date | null }> {
        const member = await this.conversationsService.validateMembership(conversationId, currentUserId);

        if (isPinned && !member.isPinned) {
            const pinnedCount = await this.memberRepository.count({
                where: { user: { id: currentUserId }, isPinned: true },
            });
            if (pinnedCount >= MAX_PINNED_CONVERSATIONS) {
                throw new BadRequestException(
                    `Chỉ được ghim tối đa ${MAX_PINNED_CONVERSATIONS} cuộc trò chuyện. Hãy bỏ ghim một cuộc trò chuyện khác trước.`,
                );
            }
            member.isPinned = true;
            member.pinnedAt = new Date();
            await this.memberRepository.save(member);
        } else if (!isPinned && member.isPinned) {
            member.isPinned = false;
            member.pinnedAt = null;
            await this.memberRepository.save(member);
        }

        return {
            conversationId,
            isPinned: Boolean(member.isPinned),
            pinnedAt: member.pinnedAt ?? null,
        };
    }

    /**
     * "Xóa đoạn chat" chỉ cho người gọi: đặt mốc clearedAt = now và reset unreadCount.
     * Tin nhắn createdAt <= clearedAt bị ẩn với riêng họ; dữ liệu thật và các thành viên khác không bị ảnh hưởng (FR-48).
     */
    async clearHistory(
        currentUserId: string,
        conversationId: string,
    ): Promise<{ conversationId: string; clearedAt: Date }> {
        const member = await this.conversationsService.validateMembership(conversationId, currentUserId);

        const clearedAt = new Date();
        member.clearedAt = clearedAt;
        member.unreadCount = 0;
        await this.memberRepository.save(member);

        return { conversationId, clearedAt };
    }
}
