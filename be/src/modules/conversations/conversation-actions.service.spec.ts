import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConversationActionsService, MAX_PINNED_CONVERSATIONS } from './conversation-actions.service.js';
import { ConversationsService } from './conversations.service.js';
import { ConversationMember } from './entities/conversation-member.entity.js';

describe('ConversationActionsService (FR-48)', () => {
    let service: ConversationActionsService;
    let mockMemberRepo: any;
    let mockConversationsService: any;
    const userId = 'user-1';
    const conversationId = 'conv-1';

    beforeEach(async () => {
        mockMemberRepo = {
            count: vi.fn().mockResolvedValue(0),
            save: vi.fn((m) => Promise.resolve(m)),
        };
        mockConversationsService = {
            validateMembership: vi
                .fn()
                .mockResolvedValue({ id: 'm-1', isPinned: false, pinnedAt: null, unreadCount: 7, clearedAt: null }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConversationActionsService,
                { provide: getRepositoryToken(ConversationMember), useValue: mockMemberRepo },
                { provide: ConversationsService, useValue: mockConversationsService },
            ],
        }).compile();
        service = module.get(ConversationActionsService);
    });

    describe('setPinned', () => {
        it('pins the conversation for the caller only and returns pinnedAt', async () => {
            const result = await service.setPinned(userId, conversationId, true);

            expect(mockConversationsService.validateMembership).toHaveBeenCalledWith(conversationId, userId);
            expect(mockMemberRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1', isPinned: true }));
            expect(result).toEqual({ conversationId, isPinned: true, pinnedAt: expect.any(Date) });
        });

        it('rejects with 400 when the user already pinned the maximum number of conversations', async () => {
            mockMemberRepo.count.mockResolvedValue(MAX_PINNED_CONVERSATIONS);

            await expect(service.setPinned(userId, conversationId, true)).rejects.toThrow(BadRequestException);
            expect(mockMemberRepo.save).not.toHaveBeenCalled();
        });

        it('allows pinning the 5th conversation (4 already pinned)', async () => {
            mockMemberRepo.count.mockResolvedValue(MAX_PINNED_CONVERSATIONS - 1);
            const result = await service.setPinned(userId, conversationId, true);
            expect(result.isPinned).toBe(true);
        });

        it('is idempotent when already pinned (no limit check, keeps pinnedAt)', async () => {
            const pinnedAt = new Date('2026-01-01T00:00:00.000Z');
            mockConversationsService.validateMembership.mockResolvedValue({ id: 'm-1', isPinned: true, pinnedAt });
            mockMemberRepo.count.mockResolvedValue(MAX_PINNED_CONVERSATIONS);

            const result = await service.setPinned(userId, conversationId, true);

            expect(result).toEqual({ conversationId, isPinned: true, pinnedAt });
            expect(mockMemberRepo.save).not.toHaveBeenCalled();
        });

        it('unpins and clears pinnedAt', async () => {
            mockConversationsService.validateMembership.mockResolvedValue({
                id: 'm-1',
                isPinned: true,
                pinnedAt: new Date(),
            });

            const result = await service.setPinned(userId, conversationId, false);

            expect(mockMemberRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ isPinned: false, pinnedAt: null }),
            );
            expect(result).toEqual({ conversationId, isPinned: false, pinnedAt: null });
        });

        it('propagates 403 for non-members (BR-08)', async () => {
            mockConversationsService.validateMembership.mockRejectedValue(new ForbiddenException());
            await expect(service.setPinned(userId, conversationId, true)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('clearHistory', () => {
        it('sets clearedAt = now and resets unreadCount for the caller only', async () => {
            const before = Date.now();
            const result = await service.clearHistory(userId, conversationId);

            expect(mockMemberRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'm-1', unreadCount: 0, clearedAt: expect.any(Date) }),
            );
            expect(result.conversationId).toBe(conversationId);
            expect(result.clearedAt.getTime()).toBeGreaterThanOrEqual(before);
        });

        it('propagates 403 for non-members (BR-08)', async () => {
            mockConversationsService.validateMembership.mockRejectedValue(new ForbiddenException());
            await expect(service.clearHistory(userId, conversationId)).rejects.toThrow(ForbiddenException);
            expect(mockMemberRepo.save).not.toHaveBeenCalled();
        });
    });
});
