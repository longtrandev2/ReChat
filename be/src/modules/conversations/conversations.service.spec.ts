import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { Conversation, ConversationType } from './entities/conversation.entity.js';
import { ConversationMember, ConversationRole } from './entities/conversation-member.entity.js';
import { Message, MessageType } from './entities/message.entity.js';
import { MessageReaction } from './entities/message-reaction.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Friendship, FriendshipStatus } from '../friends/entities/friendship.entity.js';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ConversationsService', () => {
    let service: ConversationsService;
    let mockConversationRepo: any;
    let mockMemberRepo: any;
    let mockMessageRepo: any;
    let mockReactionRepo: any;
    let mockUserRepo: any;
    let mockFriendshipRepo: any;
    let mockEventEmitter: any;

    const createMockQueryBuilder = (result: any = []) => ({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
        getOne: vi.fn().mockResolvedValue(Array.isArray(result) ? result[0] || null : result),
        getMany: vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]),
    });

    beforeEach(async () => {
        mockConversationRepo = {
            findOne: vi.fn(),
            find: vi.fn(),
            create: vi.fn((data) => ({ id: 'conv-uuid-created', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
            delete: vi.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
        };

        mockMemberRepo = {
            findOne: vi.fn(),
            find: vi.fn().mockResolvedValue([]),
            create: vi.fn((data) => ({ id: 'member-uuid-created', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            delete: vi.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
        };

        mockMessageRepo = {
            findOne: vi.fn(),
            findOneOrFail: vi.fn(),
            find: vi.fn(),
            create: vi.fn((data) => ({ id: 'msg-uuid-created', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            delete: vi.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: vi.fn(() => createMockQueryBuilder()),
        };

        mockUserRepo = {
            findOne: vi.fn(),
            find: vi.fn(),
        };

        mockFriendshipRepo = {
            findOne: vi.fn(),
        };

        mockEventEmitter = {
            emit: vi.fn(),
        };

        mockReactionRepo = {
            findOne: vi.fn().mockResolvedValue(null),
            find: vi.fn().mockResolvedValue([]),
            create: vi.fn((data) => ({ id: 'reaction-uuid', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            remove: vi.fn().mockResolvedValue({ affected: 1 }),
            delete: vi.fn().mockResolvedValue({ affected: 1 }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConversationsService,
                { provide: getRepositoryToken(Conversation), useValue: mockConversationRepo },
                { provide: getRepositoryToken(ConversationMember), useValue: mockMemberRepo },
                { provide: getRepositoryToken(Message), useValue: mockMessageRepo },
                { provide: getRepositoryToken(MessageReaction), useValue: mockReactionRepo },
                { provide: getRepositoryToken(User), useValue: mockUserRepo },
                { provide: getRepositoryToken(Friendship), useValue: mockFriendshipRepo },
                { provide: EventEmitter2, useValue: mockEventEmitter },
            ],
        }).compile();

        service = module.get<ConversationsService>(ConversationsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ==========================================
    // 1. createOrGetDirect
    // ==========================================
    describe('createOrGetDirect', () => {
        const currentUserId = 'user-current';
        const targetUserId = 'user-target';

        it('should throw BadRequestException if currentUserId === targetUserId (BR-03)', async () => {
            await expect(service.createOrGetDirect(currentUserId, currentUserId))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if target user does not exist', async () => {
            mockUserRepo.findOne.mockResolvedValue(null);
            await expect(service.createOrGetDirect(currentUserId, targetUserId))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if users are not friends (ACCEPTED)', async () => {
            mockUserRepo.findOne.mockResolvedValue({ id: targetUserId });
            mockFriendshipRepo.findOne.mockResolvedValue(null);

            await expect(service.createOrGetDirect(currentUserId, targetUserId))
                .rejects.toThrow(ForbiddenException);
        });

        it('should return existing conversation if DIRECT conversation already exists (BR-05)', async () => {
            const targetUser = { id: targetUserId };
            mockUserRepo.findOne.mockResolvedValue(targetUser);
            mockFriendshipRepo.findOne.mockResolvedValue({ status: FriendshipStatus.ACCEPTED });

            const existingConv = { id: 'conv-existing-uuid', type: ConversationType.DIRECT };
            mockConversationRepo.createQueryBuilder.mockReturnValue(createMockQueryBuilder(existingConv));

            const result = await service.createOrGetDirect(currentUserId, targetUserId);
            expect(result).toEqual(existingConv);
            expect(mockConversationRepo.save).not.toHaveBeenCalled();
        });

        it('should create new DIRECT conversation with 2 members when not existing', async () => {
            const targetUser = { id: targetUserId };
            mockUserRepo.findOne.mockResolvedValue(targetUser);
            mockFriendshipRepo.findOne.mockResolvedValue({ status: FriendshipStatus.ACCEPTED });
            mockConversationRepo.createQueryBuilder.mockReturnValue(createMockQueryBuilder(null));

            const result = await service.createOrGetDirect(currentUserId, targetUserId);

            expect(result).toBeDefined();
            expect(mockConversationRepo.create).toHaveBeenCalledWith({ type: ConversationType.DIRECT });
            expect(mockMemberRepo.save).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'conversation.created',
                expect.objectContaining({
                    memberIds: [currentUserId, targetUserId],
                }),
            );
        });
    });

    // ==========================================
    // 2. createGroup
    // ==========================================
    describe('createGroup', () => {
        const ownerId = 'user-owner';

        it('should throw BadRequestException if less than 1 other member provided (BR-07)', async () => {
            await expect(service.createGroup(ownerId, { name: 'My Group', memberIds: [ownerId] }))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if one or more memberIds do not exist', async () => {
            mockUserRepo.find.mockResolvedValue([{ id: 'user-2' }]); // only 1 found while 2 requested
            await expect(service.createGroup(ownerId, { name: 'My Group', memberIds: ['user-2', 'user-3'] }))
                .rejects.toThrow(NotFoundException);
        });

        it('should create group conversation with OWNER and MEMBERS (BR-06, BR-07)', async () => {
            const memberIds = ['user-2', 'user-3'];
            mockUserRepo.find.mockResolvedValue([{ id: 'user-2' }, { id: 'user-3' }]);

            const result = await service.createGroup(ownerId, { name: 'Group Alpha', memberIds });

            expect(result).toBeDefined();
            expect(mockConversationRepo.create).toHaveBeenCalledWith({
                type: ConversationType.GROUP,
                name: 'Group Alpha',
            });
            expect(mockMemberRepo.save).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'conversation.created',
                expect.objectContaining({
                    memberIds: [ownerId, ...memberIds],
                }),
            );
        });
    });

    // ==========================================
    // 3. addMembers
    // ==========================================
    describe('addMembers', () => {
        const currentUserId = 'user-1';
        const conversationId = 'conv-1';

        it('should throw NotFoundException if conversation does not exist', async () => {
            mockConversationRepo.findOne.mockResolvedValue(null);
            await expect(service.addMembers(currentUserId, conversationId, { memberIds: ['user-2'] }))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if conversation is DIRECT', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.DIRECT });
            await expect(service.addMembers(currentUserId, conversationId, { memberIds: ['user-2'] }))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if current user is not a group member (BR-08)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue(null);

            await expect(service.addMembers(currentUserId, conversationId, { memberIds: ['user-2'] }))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException if some users do not exist', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockUserRepo.find.mockResolvedValue([]); // not found

            await expect(service.addMembers(currentUserId, conversationId, { memberIds: ['user-ghost'] }))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw ConflictException if all users are already group members', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockUserRepo.find.mockResolvedValue([{ id: 'user-2' }]);
            mockMemberRepo.find.mockResolvedValue([{ user: { id: 'user-2' } }]);

            await expect(service.addMembers(currentUserId, conversationId, { memberIds: ['user-2'] }))
                .rejects.toThrow(ConflictException);
        });

        it('should add only new members successfully', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockUserRepo.find.mockResolvedValue([{ id: 'user-2' }, { id: 'user-3' }]);
            mockMemberRepo.find.mockResolvedValue([{ user: { id: 'user-2' } }]); // user-2 already member

            const result = await service.addMembers(currentUserId, conversationId, { memberIds: ['user-2', 'user-3'] });
            expect(result.addedCount).toBe(1);
            expect(mockMemberRepo.save).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'group.member_event',
                expect.objectContaining({
                    action: 'ADDED',
                    targetUserIds: ['user-3'],
                }),
            );
        });
    });

    // ==========================================
    // 4. leaveGroup
    // ==========================================
    describe('leaveGroup', () => {
        const currentUserId = 'user-1';
        const conversationId = 'conv-1';

        it('should throw NotFoundException if conversation does not exist', async () => {
            mockConversationRepo.findOne.mockResolvedValue(null);
            await expect(service.leaveGroup(currentUserId, conversationId))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if conversation is DIRECT', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.DIRECT });
            await expect(service.leaveGroup(currentUserId, conversationId))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if current user is not a member', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue(null);

            await expect(service.leaveGroup(currentUserId, conversationId))
                .rejects.toThrow(NotFoundException);
        });

        it('should allow regular MEMBER to leave without transferring ownership', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1', role: ConversationRole.MEMBER });

            const result = await service.leaveGroup(currentUserId, conversationId);
            expect(result.message).toContain('rời nhóm thành công');
            expect(mockMemberRepo.delete).toHaveBeenCalledWith('m-1');
        });

        it('should transfer ownership to earliest joined member when OWNER leaves (BR-12)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-owner', role: ConversationRole.OWNER });

            const remainingMember = { id: 'm-earliest', role: ConversationRole.MEMBER, joinedAt: new Date('2026-10-01') };
            mockMemberRepo.find.mockResolvedValue([remainingMember]);

            const result = await service.leaveGroup(currentUserId, conversationId);
            expect(result.message).toContain('Quyền trưởng nhóm đã được chuyển giao');
            expect(remainingMember.role).toBe(ConversationRole.OWNER);
            expect(mockMemberRepo.save).toHaveBeenCalledWith(remainingMember);
        });

        it('should disband group when OWNER leaves and no members are left (BR-12)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-owner', role: ConversationRole.OWNER });
            mockMemberRepo.find.mockResolvedValue([]); // no remaining members

            const result = await service.leaveGroup(currentUserId, conversationId);
            expect(result.message).toContain('giải tán nhóm thành công');
            expect(mockConversationRepo.delete).toHaveBeenCalledWith(conversationId);
        });
    });

    // ==========================================
    // 5. getInbox
    // ==========================================
    describe('getInbox', () => {
        it('should return empty array if user has no conversations', async () => {
            mockConversationRepo.createQueryBuilder.mockReturnValue(createMockQueryBuilder([]));
            const result = await service.getInbox('user-empty');
            expect(result).toEqual([]);
        });

        it('should return properly mapped inbox for DIRECT and GROUP conversations', async () => {
            const currentUserId = 'user-me';
            const mockConversations = [
                {
                    id: 'conv-direct',
                    type: ConversationType.DIRECT,
                    lastMessageId: 'msg-1',
                    members: [
                        { user: { id: currentUserId, displayName: 'Me' }, unreadCount: 2 },
                        { user: { id: 'user-partner', displayName: 'Partner A', avatarUrl: 'p-avatar' } },
                    ],
                },
                {
                    id: 'conv-group',
                    type: ConversationType.GROUP,
                    name: 'Dev Team',
                    avatarUrl: 'group-avatar',
                    lastMessageId: null,
                    members: [
                        { user: { id: currentUserId }, unreadCount: 0 },
                    ],
                },
            ];

            mockConversationRepo.createQueryBuilder.mockReturnValue(createMockQueryBuilder(mockConversations));
            mockMessageRepo.find.mockResolvedValue([
                {
                    id: 'msg-1',
                    content: 'Hello there',
                    type: MessageType.TEXT,
                    createdAt: new Date(),
                    sender: { id: 'user-partner', username: 'partner', displayName: 'Partner A' },
                },
            ]);

            const inbox = await service.getInbox(currentUserId);
            expect(inbox).toHaveLength(2);
            expect(inbox[0].name).toBe('Partner A');
            expect(inbox[0].unreadCount).toBe(2);
            expect(inbox[0].lastMessage.content).toBe('Hello there');
            expect(inbox[1].name).toBe('Dev Team');
            expect(inbox[1].unreadCount).toBe(0);
        });
    });

    // ==========================================
    // 6. getMessages
    // ==========================================
    describe('getMessages', () => {
        const currentUserId = 'user-1';
        const conversationId = 'conv-1';

        it('should throw NotFoundException if conversation does not exist', async () => {
            mockConversationRepo.findOne.mockResolvedValue(null);
            await expect(service.getMessages(currentUserId, conversationId, {}))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not a conversation member (BR-08)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValue(null);

            await expect(service.getMessages(currentUserId, conversationId, {}))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw BadRequestException if before cursor does not exist in conversation', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockMessageRepo.findOne.mockResolvedValue(null);

            await expect(service.getMessages(currentUserId, conversationId, { before: 'msg-non-existent' }))
                .rejects.toThrow(BadRequestException);
        });

        it('should return messages in chronological ascending order (ASC)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });

            const msg1 = { id: 'msg-1', createdAt: new Date('2026-10-14T10:00:00Z') };
            const msg2 = { id: 'msg-2', createdAt: new Date('2026-10-14T09:00:00Z') };
            // getMany returns in DESC order: [msg1, msg2]
            mockMessageRepo.createQueryBuilder.mockReturnValue(createMockQueryBuilder([msg1, msg2]));

            const result = await service.getMessages(currentUserId, conversationId, { limit: 10 });
            // reverse() should return [msg2, msg1] (ASC)
            expect(result).toEqual([msg2, msg1]);
        });

        it('should apply type filter when query.type is provided (e.g. IMAGE or FILE)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });

            const mockQb = createMockQueryBuilder([]);
            mockMessageRepo.createQueryBuilder.mockReturnValue(mockQb);

            await service.getMessages(currentUserId, conversationId, {
                limit: 20,
                type: MessageType.IMAGE,
            });

            expect(mockQb.andWhere).toHaveBeenCalledWith('m.type = :messageType', {
                messageType: MessageType.IMAGE,
            });
        });

        it('should correctly enrich messages with reactions loaded from database', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });

            const msg1 = { id: 'msg-1', createdAt: new Date('2026-10-14T10:00:00Z') };
            mockMessageRepo.createQueryBuilder.mockReturnValue(createMockQueryBuilder([msg1]));

            mockReactionRepo.find.mockResolvedValueOnce([
                {
                    id: 'r-1',
                    emoji: '❤️',
                    message: { id: 'msg-1' },
                    user: { id: 'user-1', displayName: 'Người dùng 1' },
                },
                {
                    id: 'r-2',
                    emoji: '❤️',
                    message: { id: 'msg-1' },
                    user: { id: 'user-2', displayName: 'Người dùng 2' },
                },
            ]);

            const result = await service.getMessages(currentUserId, conversationId, { limit: 10 });
            expect(result).toHaveLength(1);
            expect((result[0] as any).reactions).toEqual([
                {
                    emoji: '❤️',
                    count: 2,
                    users: [
                        { id: 'user-1', displayName: 'Người dùng 1' },
                        { id: 'user-2', displayName: 'Người dùng 2' },
                    ],
                    hasReacted: true,
                },
            ]);
        });
    });

    // ==========================================
    // 7. markAsRead
    // ==========================================
    describe('markAsRead', () => {
        it('should throw ForbiddenException if user is not a member', async () => {
            mockMemberRepo.findOne.mockResolvedValue(null);
            await expect(service.markAsRead('user-1', 'conv-1')).rejects.toThrow(ForbiddenException);
        });

        it('should reset unreadCount to 0 and set lastReadMessageId (BR-10)', async () => {
            const member = { id: 'm-1', unreadCount: 5, lastReadMessageId: null };
            mockMemberRepo.findOne.mockResolvedValue(member);
            mockConversationRepo.findOne.mockResolvedValue({ id: 'conv-1', lastMessageId: 'msg-latest' });

            const result = await service.markAsRead('user-1', 'conv-1');
            expect(result.message).toContain('thành công');
            expect(member.unreadCount).toBe(0);
            expect(member.lastReadMessageId).toBe('msg-latest');
            expect(mockMemberRepo.save).toHaveBeenCalledWith(member);
        });
    });

    // ==========================================
    // 8. getConversationDetail
    // ==========================================
    describe('getConversationDetail', () => {
        it('should throw NotFoundException if conversation not found', async () => {
            mockConversationRepo.findOne.mockResolvedValue(null);
            await expect(service.getConversationDetail('user-1', 'conv-not-found')).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not in conversation (BR-08)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({
                id: 'conv-1',
                members: [{ user: { id: 'other-user' } }],
            });
            await expect(service.getConversationDetail('user-1', 'conv-1')).rejects.toThrow(ForbiddenException);
        });

        it('should return conversation detail with members and roles for GROUP', async () => {
            const conv = {
                id: 'conv-group',
                type: ConversationType.GROUP,
                name: 'Group Beta',
                avatarUrl: 'beta-avatar',
                members: [
                    {
                        id: 'm-1',
                        role: ConversationRole.OWNER,
                        joinedAt: new Date(),
                        unreadCount: 0,
                        user: { id: 'user-1', username: 'u1', displayName: 'User 1', isOnline: true },
                    },
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockConversationRepo.findOne.mockResolvedValue(conv);

            const result = await service.getConversationDetail('user-1', 'conv-group');
            expect(result.id).toBe('conv-group');
            expect(result.name).toBe('Group Beta');
            expect(result.currentUserRole).toBe(ConversationRole.OWNER);
            expect(result.members).toHaveLength(1);
        });
    });

    // ==========================================
    // 9. updateGroup
    // ==========================================
    describe('updateGroup', () => {
        it('should throw NotFoundException if conversation not found', async () => {
            mockConversationRepo.findOne.mockResolvedValue(null);
            await expect(service.updateGroup('user-1', 'conv-1', { name: 'New Name' }))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if conversation is DIRECT', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: 'conv-1', type: ConversationType.DIRECT });
            await expect(service.updateGroup('user-1', 'conv-1', { name: 'New Name' }))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if user is not a group member', async () => {
            mockConversationRepo.findOne.mockResolvedValue({ id: 'conv-1', type: ConversationType.GROUP });
            mockMemberRepo.findOne.mockResolvedValue(null);

            await expect(service.updateGroup('user-1', 'conv-1', { name: 'New Name' }))
                .rejects.toThrow(ForbiddenException);
        });

        it('should allow any member to update group name and avatarUrl (BR-17)', async () => {
            const conv = { id: 'conv-1', type: ConversationType.GROUP, name: 'Old Name', avatarUrl: null };
            mockConversationRepo.findOne.mockResolvedValue(conv);
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-member', role: ConversationRole.MEMBER });

            await service.updateGroup('user-1', 'conv-1', { name: 'Updated Name', avatarUrl: 'new-avatar' });
            expect(conv.name).toBe('Updated Name');
            expect(conv.avatarUrl).toBe('new-avatar');
            expect(mockConversationRepo.save).toHaveBeenCalledWith(conv);
        });
    });

    // ==========================================
    // 10. kickMember
    // ==========================================
    describe('kickMember', () => {
        const conversationId = 'conv-group';
        const ownerId = 'user-owner';
        const adminId = 'user-admin';
        const memberId = 'user-member';

        beforeEach(() => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
        });

        it('should throw BadRequestException on self kick', async () => {
            await expect(service.kickMember(ownerId, conversationId, ownerId))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if caller is not a member', async () => {
            mockMemberRepo.findOne.mockResolvedValue(null);
            await expect(service.kickMember('user-intruder', conversationId, memberId))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException if caller is regular MEMBER (BR-14)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-caller', role: ConversationRole.MEMBER });
            await expect(service.kickMember(memberId, conversationId, 'user-other'))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException if target user is not in group', async () => {
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-owner', role: ConversationRole.OWNER }) // caller
                .mockResolvedValueOnce(null); // target

            await expect(service.kickMember(ownerId, conversationId, 'user-not-in-group'))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if target is OWNER (BR-14)', async () => {
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-admin', role: ConversationRole.ADMIN })
                .mockResolvedValueOnce({ id: 'm-owner', role: ConversationRole.OWNER });

            await expect(service.kickMember(adminId, conversationId, ownerId))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException if ADMIN attempts to kick another ADMIN (BR-14)', async () => {
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-admin1', role: ConversationRole.ADMIN })
                .mockResolvedValueOnce({ id: 'm-admin2', role: ConversationRole.ADMIN });

            await expect(service.kickMember(adminId, conversationId, 'user-admin-2'))
                .rejects.toThrow(ForbiddenException);
        });

        it('should allow OWNER to kick MEMBER or ADMIN (Happy Path)', async () => {
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-owner', role: ConversationRole.OWNER })
                .mockResolvedValueOnce({ id: 'm-admin', role: ConversationRole.ADMIN });

            const result = await service.kickMember(ownerId, conversationId, adminId);
            expect(result.message).toContain('thành công');
            expect(mockMemberRepo.delete).toHaveBeenCalledWith('m-admin');
        });

        it('should allow ADMIN to kick regular MEMBER (Happy Path)', async () => {
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-admin', role: ConversationRole.ADMIN })
                .mockResolvedValueOnce({ id: 'm-member', role: ConversationRole.MEMBER });

            const result = await service.kickMember(adminId, conversationId, memberId);
            expect(result.message).toContain('thành công');
            expect(mockMemberRepo.delete).toHaveBeenCalledWith('m-member');
        });
    });

    // ==========================================
    // 11. transferOwnership
    // ==========================================
    describe('transferOwnership', () => {
        const conversationId = 'conv-group';
        const ownerId = 'user-owner';
        const targetId = 'user-target';

        beforeEach(() => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
        });

        it('should throw ForbiddenException if caller is not OWNER (BR-15)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-admin', role: ConversationRole.ADMIN });
            await expect(service.transferOwnership('user-admin', conversationId, { newOwnerId: targetId }))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw BadRequestException if transferring to oneself', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-owner', role: ConversationRole.OWNER });
            await expect(service.transferOwnership(ownerId, conversationId, { newOwnerId: ownerId }))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if new owner is not in the group', async () => {
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-owner', role: ConversationRole.OWNER })
                .mockResolvedValueOnce(null);

            await expect(service.transferOwnership(ownerId, conversationId, { newOwnerId: 'user-outsider' }))
                .rejects.toThrow(NotFoundException);
        });

        it('should transfer OWNER role to target and demote old owner to ADMIN (BR-15)', async () => {
            const currentOwner = { id: 'm-owner', role: ConversationRole.OWNER };
            const newOwner = { id: 'm-target', role: ConversationRole.MEMBER };

            mockMemberRepo.findOne
                .mockResolvedValueOnce(currentOwner)
                .mockResolvedValueOnce(newOwner);

            const result = await service.transferOwnership(ownerId, conversationId, { newOwnerId: targetId });
            expect(result.message).toContain('thành công');
            expect(newOwner.role).toBe(ConversationRole.OWNER);
            expect(currentOwner.role).toBe(ConversationRole.ADMIN);
            expect(mockMemberRepo.save).toHaveBeenCalledWith([newOwner, currentOwner]);
        });
    });

    // ==========================================
    // 12. updateMemberRole
    // ==========================================
    describe('updateMemberRole', () => {
        const conversationId = 'conv-group';
        const ownerId = 'user-owner';
        const targetId = 'user-target';

        beforeEach(() => {
            mockConversationRepo.findOne.mockResolvedValue({ id: conversationId, type: ConversationType.GROUP });
        });

        it('should throw ForbiddenException if caller is not OWNER (BR-16)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-admin', role: ConversationRole.ADMIN });
            await expect(service.updateMemberRole('user-admin', conversationId, targetId, { role: ConversationRole.ADMIN }))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw BadRequestException if updating own role', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-owner', role: ConversationRole.OWNER });
            await expect(service.updateMemberRole(ownerId, conversationId, ownerId, { role: ConversationRole.ADMIN }))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if target member not found in group', async () => {
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-owner', role: ConversationRole.OWNER })
                .mockResolvedValueOnce(null);

            await expect(service.updateMemberRole(ownerId, conversationId, 'user-ghost', { role: ConversationRole.ADMIN }))
                .rejects.toThrow(NotFoundException);
        });

        it('should successfully promote MEMBER to ADMIN (BR-16)', async () => {
            const targetMember = { id: 'm-target', role: ConversationRole.MEMBER, user: { id: targetId } };
            mockMemberRepo.findOne
                .mockResolvedValueOnce({ id: 'm-owner', role: ConversationRole.OWNER })
                .mockResolvedValueOnce(targetMember);

            const result = await service.updateMemberRole(ownerId, conversationId, targetId, { role: ConversationRole.ADMIN });
            expect(result.member.role).toBe(ConversationRole.ADMIN);
            expect(mockMemberRepo.save).toHaveBeenCalledWith(targetMember);
        });
    });

    // ==========================================
    // 13. pinMessage & unpinMessage
    // ==========================================
    describe('pinMessage & unpinMessage', () => {
        const conversationId = 'conv-1';
        const userId = 'user-1';
        const messageId = 'msg-1';

        it('should throw ForbiddenException if user is not in conversation (BR-08)', async () => {
            mockMemberRepo.findOne.mockResolvedValue(null);
            await expect(service.pinMessage(userId, conversationId, messageId)).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException if message does not exist in conversation', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockMessageRepo.findOne.mockResolvedValue(null);
            await expect(service.pinMessage(userId, conversationId, messageId)).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if message is recalled (BR-18)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockMessageRepo.findOne.mockResolvedValue({ id: messageId, isRecalled: true });
            await expect(service.pinMessage(userId, conversationId, messageId)).rejects.toThrow(BadRequestException);
        });

        it('should pin message successfully', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            const msg = { id: messageId, isRecalled: false, isPinned: false };
            mockMessageRepo.findOne.mockResolvedValue(msg);

            const result = await service.pinMessage(userId, conversationId, messageId);
            expect(result.isPinned).toBe(true);
            expect(result.pinnedAt).toBeDefined();
            expect(mockMessageRepo.save).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'message.pinned',
                expect.objectContaining({
                    conversationId,
                    messageId,
                    isPinned: true,
                }),
            );
        });

        it('should throw BadRequestException if trying to unpin an unpinned message', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockMessageRepo.findOne.mockResolvedValue({ id: messageId, isPinned: false });
            await expect(service.unpinMessage(userId, conversationId, messageId)).rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if unpinner is neither pinner nor staff (BR-18)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1', role: ConversationRole.MEMBER });
            mockMessageRepo.findOne.mockResolvedValue({
                id: messageId,
                isPinned: true,
                pinnedBy: { id: 'other-user' },
            });

            await expect(service.unpinMessage(userId, conversationId, messageId)).rejects.toThrow(ForbiddenException);
        });

        it('should allow pinner to unpin message', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1', role: ConversationRole.MEMBER });
            const msg = { id: messageId, isPinned: true, pinnedBy: { id: userId } };
            mockMessageRepo.findOne.mockResolvedValue(msg);

            const result = await service.unpinMessage(userId, conversationId, messageId);
            expect(result.message).toContain('thành công');
            expect(msg.isPinned).toBe(false);
            expect(mockMessageRepo.save).toHaveBeenCalled();
        });

        it('should allow group OWNER or ADMIN to unpin message pinned by someone else (BR-18)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-admin', role: ConversationRole.ADMIN });
            const msg = { id: messageId, isPinned: true, pinnedBy: { id: 'other-member' } };
            mockMessageRepo.findOne.mockResolvedValue(msg);

            const result = await service.unpinMessage(userId, conversationId, messageId);
            expect(result.message).toContain('thành công');
            expect(msg.isPinned).toBe(false);
        });
    });

    // ==========================================
    // 14. getPinnedMessages
    // ==========================================
    describe('getPinnedMessages', () => {
        it('should throw ForbiddenException if user is not in conversation', async () => {
            mockMemberRepo.findOne.mockResolvedValue(null);
            await expect(service.getPinnedMessages('user-1', 'conv-1')).rejects.toThrow(ForbiddenException);
        });

        it('should return pinned messages ordered by pinnedAt DESC', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            const mockPinned = [{ id: 'msg-p1', isPinned: true }, { id: 'msg-p2', isPinned: true }];
            mockMessageRepo.find.mockResolvedValue(mockPinned);

            const result = await service.getPinnedMessages('user-1', 'conv-1');
            expect(result).toEqual(mockPinned);
            expect(mockMessageRepo.find).toHaveBeenCalledWith({
                where: {
                    conversation: { id: 'conv-1' },
                    isPinned: true,
                    isRecalled: false,
                },
                relations: { sender: true, pinnedBy: true },
                order: { pinnedAt: 'DESC' },
            });
        });
    });

    // ==========================================
    // 15. getMediaMessages
    // ==========================================
    describe('getMediaMessages', () => {
        it('should throw ForbiddenException if user is not in conversation', async () => {
            mockMemberRepo.findOne.mockResolvedValue(null);
            await expect(service.getMediaMessages('user-1', 'conv-1', {})).rejects.toThrow(ForbiddenException);
        });

        it('should throw BadRequestException if before cursor not found', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            mockMessageRepo.findOne.mockResolvedValue(null);

            await expect(service.getMediaMessages('user-1', 'conv-1', { before: 'msg-ghost' }))
                .rejects.toThrow(BadRequestException);
        });

        it('should query media messages with proper filters (BR-19)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
            const mockMedia = [{ id: 'm-img', type: MessageType.IMAGE }];
            mockMessageRepo.createQueryBuilder.mockReturnValue(createMockQueryBuilder(mockMedia));

            const result = await service.getMediaMessages('user-1', 'conv-1', { type: MessageType.IMAGE, limit: 10 });
            expect(result).toEqual(mockMedia);
        });
    });

    // ==========================================
    // 16. getConversationActiveStatus
    // ==========================================
    describe('getConversationActiveStatus', () => {
        const currentUserId = 'user-me';
        const conversationId = 'conv-1';

        it('should throw NotFoundException if conversation does not exist', async () => {
            mockConversationRepo.findOne.mockResolvedValue(null);
            await expect(service.getConversationActiveStatus(currentUserId, conversationId)).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not a member (BR-08)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({
                id: conversationId,
                members: [{ user: { id: 'other-user' } }],
            });
            await expect(service.getConversationActiveStatus(currentUserId, conversationId)).rejects.toThrow(ForbiddenException);
        });

        it('should return isActive: true for DIRECT when partner is online', async () => {
            mockConversationRepo.findOne.mockResolvedValue({
                id: conversationId,
                type: ConversationType.DIRECT,
                members: [
                    { user: { id: currentUserId, isOnline: true } },
                    { user: { id: 'partner-user', isOnline: true } },
                ],
            });

            const result = await service.getConversationActiveStatus(currentUserId, conversationId);
            expect(result.isActive).toBe(true);
            expect(result.activeMemberCount).toBe(1);
        });

        it('should return isActive: false for DIRECT when partner is offline', async () => {
            mockConversationRepo.findOne.mockResolvedValue({
                id: conversationId,
                type: ConversationType.DIRECT,
                members: [
                    { user: { id: currentUserId, isOnline: true } },
                    { user: { id: 'partner-user', isOnline: false } },
                ],
            });

            const result = await service.getConversationActiveStatus(currentUserId, conversationId);
            expect(result.isActive).toBe(false);
            expect(result.activeMemberCount).toBe(0);
        });

        it('should return isActive: true for GROUP when at least 1 other member is online (BR-20)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({
                id: conversationId,
                type: ConversationType.GROUP,
                members: [
                    { user: { id: currentUserId, isOnline: false } },
                    { user: { id: 'other-1', isOnline: true } },
                    { user: { id: 'other-2', isOnline: false } },
                ],
            });

            const result = await service.getConversationActiveStatus(currentUserId, conversationId);
            expect(result.isActive).toBe(true);
            expect(result.activeMemberCount).toBe(1);
            expect(result.totalMemberCount).toBe(3);
        });

        it('should return isActive: false for GROUP when only current user is online (BR-20)', async () => {
            mockConversationRepo.findOne.mockResolvedValue({
                id: conversationId,
                type: ConversationType.GROUP,
                members: [
                    { user: { id: currentUserId, isOnline: true } },
                    { user: { id: 'other-1', isOnline: false } },
                    { user: { id: 'other-2', isOnline: false } },
                ],
            });

            const result = await service.getConversationActiveStatus(currentUserId, conversationId);
            expect(result.isActive).toBe(false);
            expect(result.activeMemberCount).toBe(0);
        });
    });

    describe('validateMembership (BR-08)', () => {
        const conversationId = 'conv-123';
        const userId = 'user-123';

        it('should return member if user is a member of the conversation', async () => {
            const mockMember = { id: 'mem-1', conversation: { id: conversationId }, user: { id: userId } };
            mockMemberRepo.findOne.mockResolvedValue(mockMember);

            const result = await service.validateMembership(conversationId, userId);
            expect(result).toEqual(mockMember);
            expect(mockMemberRepo.findOne).toHaveBeenCalledWith({
                where: { conversation: { id: conversationId }, user: { id: userId } },
                relations: { user: true },
            });
        });

        it('should throw ForbiddenException if user is not a member (BR-08)', async () => {
            mockMemberRepo.findOne.mockResolvedValue(null);

            await expect(service.validateMembership(conversationId, userId)).rejects.toThrow(
                ForbiddenException,
            );
        });
    });

    describe('createMessage (FR-15, BR-08, BR-09, BR-10)', () => {
        const senderId = 'sender-uuid-1';
        const conversationId = 'conv-uuid-1';
        const validDto = {
            conversationId,
            content: 'Hello, this is a real-time message!',
            type: MessageType.TEXT,
        };

        it('should throw ForbiddenException if sender is not a member of the conversation (BR-08)', async () => {
            mockMemberRepo.findOne.mockResolvedValue(null);

            await expect(service.createMessage(senderId, validDto)).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should throw BadRequestException if content is empty (BR-09)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'mem-1' });

            await expect(
                service.createMessage(senderId, { ...validDto, content: '   ' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if content exceeds 2000 characters (BR-09)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'mem-1' });
            const longContent = 'a'.repeat(2001);

            await expect(
                service.createMessage(senderId, { ...validDto, content: longContent }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if replyToId does not exist in the conversation', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValue(null);

            await expect(
                service.createMessage(senderId, { ...validDto, replyToId: 'non-existent-msg' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should save message, update conversation lastMessage, increment unreadCount, and return message (BR-10)', async () => {
            mockMemberRepo.findOne.mockResolvedValue({ id: 'mem-1' });
            const savedMsg = {
                id: 'new-msg-uuid',
                content: validDto.content,
                type: MessageType.TEXT,
                createdAt: new Date(),
            };
            mockMessageRepo.save.mockResolvedValue(savedMsg);
            const populatedMsg = {
                ...savedMsg,
                sender: { id: senderId, username: 'sender1', displayName: 'Sender One' },
            };
            mockMessageRepo.findOneOrFail.mockResolvedValue(populatedMsg);

            const result = await service.createMessage(senderId, validDto);

            // 1. Verify Message was saved
            expect(mockMessageRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversation: { id: conversationId },
                    sender: { id: senderId },
                    content: validDto.content,
                    type: MessageType.TEXT,
                }),
            );
            expect(mockMessageRepo.save).toHaveBeenCalled();

            // 2. Verify Conversation lastMessage was updated
            expect(mockConversationRepo.update).toHaveBeenCalledWith(conversationId, {
                lastMessageId: savedMsg.id,
                lastMessageAt: savedMsg.createdAt,
            });

            // 3. Verify memberRepository updated unreadCount
            expect(mockMemberRepo.createQueryBuilder).toHaveBeenCalled();

            // 4. Return populated message
            expect(result).toEqual(
                expect.objectContaining({
                    ...populatedMsg,
                    replyTo: null,
                    reactions: [],
                }),
            );

            // 5. Verify inbox.updated event was emitted
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'inbox.updated',
                expect.objectContaining({
                    conversationId,
                    senderId,
                    lastMessage: expect.objectContaining({
                        id: savedMsg.id,
                        content: validDto.content,
                    }),
                }),
            );
        });
    });

    describe('recallMessage', () => {
        const conversationId = 'conv-1';
        const currentUserId = 'user-1';
        const otherUserId = 'user-2';
        const messageId = 'msg-1';

        it('nên ném lỗi NotFoundException nếu cuộc trò chuyện không tồn tại', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce(null);

            await expect(
                service.recallMessage(currentUserId, conversationId, messageId),
            ).rejects.toThrow(NotFoundException);
        });

        it('nên ném lỗi ForbiddenException nếu người dùng không thuộc cuộc trò chuyện', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce(null);

            await expect(
                service.recallMessage(currentUserId, conversationId, messageId),
            ).rejects.toThrow(ForbiddenException);
        });

        it('nên ném lỗi NotFoundException nếu tin nhắn không tồn tại', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce(null);

            await expect(
                service.recallMessage(currentUserId, conversationId, messageId),
            ).rejects.toThrow(NotFoundException);
        });

        it('nên ném lỗi ForbiddenException nếu người thu hồi không phải người gửi', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce({
                id: messageId,
                sender: { id: otherUserId },
                isRecalled: false,
            });

            await expect(
                service.recallMessage(currentUserId, conversationId, messageId),
            ).rejects.toThrow(ForbiddenException);
        });

        it('nên trả về tin nhắn ngay nếu đã được thu hồi trước đó', async () => {
            const recalledMsg = {
                id: messageId,
                sender: { id: currentUserId },
                isRecalled: true,
                content: '[Tin nhắn đã bị thu hồi]',
            };
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce(recalledMsg);

            const result = await service.recallMessage(currentUserId, conversationId, messageId);
            expect(result).toEqual(recalledMsg);
            expect(mockMessageRepo.save).not.toHaveBeenCalled();
        });

        it('nên thu hồi tin nhắn thành công bất kể thời gian gửi (Không giới hạn thời gian)', async () => {
            // Giả lập tin nhắn gửi từ 3 ngày trước (không giới hạn 60 phút)
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const msg = {
                id: messageId,
                sender: { id: currentUserId },
                content: 'Nội dung cũ',
                fileUrl: 'http://example.com/file.png',
                isRecalled: false,
                createdAt: threeDaysAgo,
            };

            mockConversationRepo.findOne.mockResolvedValueOnce({
                id: conversationId,
                lastMessageId: messageId,
            });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce(msg);
            mockMessageRepo.save.mockImplementationOnce((m: any) => Promise.resolve(m));
            mockMemberRepo.find.mockResolvedValueOnce([
                { user: { id: currentUserId } },
                { user: { id: otherUserId } },
            ]);

            const result = await service.recallMessage(currentUserId, conversationId, messageId);

            expect(result.isRecalled).toBe(true);
            expect(result.content).toBe('[Tin nhắn đã bị thu hồi]');
            expect(result.fileUrl).toBeUndefined();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'message.recalled',
                expect.objectContaining({
                    conversationId,
                    messageId,
                    senderId: currentUserId,
                    isLastMessage: true,
                    memberIds: [currentUserId, otherUserId],
                }),
            );
        });
    });

    describe('editMessage', () => {
        const conversationId = 'conv-1';
        const currentUserId = 'user-1';
        const otherUserId = 'user-2';
        const messageId = 'msg-1';

        it('nên ném lỗi NotFoundException nếu cuộc trò chuyện không tồn tại', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce(null);

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, 'Tin nhắn mới'),
            ).rejects.toThrow(NotFoundException);
        });

        it('nên ném lỗi ForbiddenException nếu người dùng không thuộc cuộc trò chuyện', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce(null);

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, 'Tin nhắn mới'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('nên ném lỗi NotFoundException nếu tin nhắn không tồn tại', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce(null);

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, 'Tin nhắn mới'),
            ).rejects.toThrow(NotFoundException);
        });

        it('nên ném lỗi ForbiddenException nếu không phải người gửi', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce({
                id: messageId,
                sender: { id: otherUserId },
            });

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, 'Tin nhắn mới'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('nên ném lỗi BadRequestException nếu tin nhắn đã bị thu hồi', async () => {
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce({
                id: messageId,
                sender: { id: currentUserId },
                isRecalled: true,
            });

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, 'Tin nhắn mới'),
            ).rejects.toThrow(BadRequestException);
        });

        it('nên ném lỗi BadRequestException nếu tin nhắn gửi quá 15 phút', async () => {
            // Giả lập tin nhắn gửi cách đây 16 phút
            const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce({
                id: messageId,
                sender: { id: currentUserId },
                isRecalled: false,
                content: 'Nội dung gốc',
                createdAt: sixteenMinutesAgo,
            });

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, 'Tin nhắn mới'),
            ).rejects.toThrow(BadRequestException);
        });

        it('nên ném lỗi BadRequestException nếu nội dung mới để trống', async () => {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce({
                id: messageId,
                sender: { id: currentUserId },
                isRecalled: false,
                content: 'Nội dung gốc',
                createdAt: fiveMinutesAgo,
            });

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, '   '),
            ).rejects.toThrow(BadRequestException);
        });

        it('nên ném lỗi BadRequestException nếu nội dung mới trùng nội dung cũ', async () => {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce({
                id: messageId,
                sender: { id: currentUserId },
                isRecalled: false,
                content: 'Nội dung gốc',
                createdAt: fiveMinutesAgo,
            });

            await expect(
                service.editMessage(currentUserId, conversationId, messageId, 'Nội dung gốc'),
            ).rejects.toThrow(BadRequestException);
        });

        it('nên chỉnh sửa tin nhắn thành công trong vòng 15 phút', async () => {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const originalMsg = {
                id: messageId,
                sender: { id: currentUserId },
                isRecalled: false,
                content: 'Nội dung gốc',
                createdAt: tenMinutesAgo,
                isEdited: false,
                editedAt: null,
            };

            mockConversationRepo.findOne.mockResolvedValueOnce({
                id: conversationId,
                lastMessageId: messageId,
            });
            mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });
            mockMessageRepo.findOne.mockResolvedValueOnce(originalMsg);
            mockMessageRepo.save.mockImplementationOnce((m: any) => Promise.resolve(m));
            mockMemberRepo.find.mockResolvedValueOnce([
                { user: { id: currentUserId } },
                { user: { id: otherUserId } },
            ]);

            const result = await service.editMessage(
                currentUserId,
                conversationId,
                messageId,
                'Nội dung đã chỉnh sửa',
            );

            expect(result.content).toBe('Nội dung đã chỉnh sửa');
            expect(result.isEdited).toBe(true);
            expect(result.editedAt).toBeInstanceOf(Date);
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'message.edited',
                expect.objectContaining({
                    conversationId,
                    messageId,
                    content: 'Nội dung đã chỉnh sửa',
                    senderId: currentUserId,
                    isLastMessage: true,
                    memberIds: [currentUserId, otherUserId],
                }),
            );
        });
    });

    // ==========================================
    // Reactions & Reply Context (Milestone 5, Scope 3)
    // ==========================================
    describe('Reactions & Reply Context (Milestone 5, Scope 3)', () => {
        const conversationId = 'conv-123';
        const currentUserId = 'user-me';
        const otherUserId = 'user-other';
        const messageId = 'msg-123';

        describe('reactMessage', () => {
            it('nên ném lỗi NotFoundException nếu cuộc trò chuyện không tồn tại', async () => {
                mockConversationRepo.findOne.mockResolvedValueOnce(null);

                await expect(
                    service.reactMessage(currentUserId, conversationId, messageId, '👍'),
                ).rejects.toThrow(NotFoundException);
            });

            it('nên ném lỗi ForbiddenException nếu người dùng không phải thành viên', async () => {
                mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
                mockMemberRepo.findOne.mockResolvedValueOnce(null);

                await expect(
                    service.reactMessage(currentUserId, conversationId, messageId, '👍'),
                ).rejects.toThrow(ForbiddenException);
            });

            it('nên ném lỗi NotFoundException nếu tin nhắn không tồn tại', async () => {
                mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
                mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1', user: { id: currentUserId } });
                mockMessageRepo.findOne.mockResolvedValueOnce(null);

                await expect(
                    service.reactMessage(currentUserId, conversationId, messageId, '👍'),
                ).rejects.toThrow(NotFoundException);
            });

            it('nên ném lỗi BadRequestException nếu tin nhắn đã bị thu hồi', async () => {
                mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
                mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1', user: { id: currentUserId } });
                mockMessageRepo.findOne.mockResolvedValueOnce({ id: messageId, isRecalled: true });

                await expect(
                    service.reactMessage(currentUserId, conversationId, messageId, '👍'),
                ).rejects.toThrow(BadRequestException);
            });

            it('nên thêm reaction mới (ADDED) khi người dùng chưa thả reaction cho tin nhắn', async () => {
                mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
                mockMemberRepo.findOne.mockResolvedValueOnce({
                    id: 'mem-1',
                    user: { id: currentUserId, displayName: 'My Name', avatarUrl: 'avatar.png' },
                });
                mockMessageRepo.findOne.mockResolvedValueOnce({ id: messageId, isRecalled: false });
                mockReactionRepo.findOne.mockResolvedValueOnce(null); // chưa có reaction
                mockReactionRepo.find.mockResolvedValueOnce([
                    {
                        id: 'r-1',
                        emoji: '❤️',
                        user: { id: currentUserId, displayName: 'My Name' },
                        message: { id: messageId },
                    },
                ]);

                const result = await service.reactMessage(currentUserId, conversationId, messageId, '❤️');

                expect(result.action).toBe('ADDED');
                expect(result.emoji).toBe('❤️');
                expect(result.reactions).toHaveLength(1);
                expect(result.reactions[0]).toEqual({
                    emoji: '❤️',
                    count: 1,
                    hasReacted: true,
                    users: [{ id: currentUserId, displayName: 'My Name' }],
                });
                expect(mockReactionRepo.create).toHaveBeenCalled();
                expect(mockReactionRepo.save).toHaveBeenCalled();
                expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                    'message.reaction_updated',
                    expect.objectContaining({
                        conversationId,
                        messageId,
                        emoji: '❤️',
                        action: 'ADDED',
                        user: expect.objectContaining({ id: currentUserId, displayName: 'My Name' }),
                    }),
                );
            });

            it('nên gỡ reaction (REMOVED) khi người dùng thả cùng emoji (toggle off)', async () => {
                const existingReaction = {
                    id: 'r-1',
                    emoji: '❤️',
                    user: { id: currentUserId },
                    message: { id: messageId },
                };

                mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
                mockMemberRepo.findOne.mockResolvedValueOnce({
                    id: 'mem-1',
                    user: { id: currentUserId, displayName: 'My Name' },
                });
                mockMessageRepo.findOne.mockResolvedValueOnce({ id: messageId, isRecalled: false });
                mockReactionRepo.findOne.mockResolvedValueOnce(existingReaction);
                mockReactionRepo.find.mockResolvedValueOnce([]); // sau khi xóa thì rỗng

                const result = await service.reactMessage(currentUserId, conversationId, messageId, '❤️');

                expect(result.action).toBe('REMOVED');
                expect(result.emoji).toBeNull();
                expect(result.reactions).toEqual([]);
                expect(mockReactionRepo.remove).toHaveBeenCalledWith(existingReaction);
                expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                    'message.reaction_updated',
                    expect.objectContaining({
                        conversationId,
                        messageId,
                        emoji: '❤️',
                        action: 'REMOVED',
                    }),
                );
            });

            it('nên đổi emoji (CHANGED) khi người dùng chọn emoji khác emoji hiện tại', async () => {
                const existingReaction = {
                    id: 'r-1',
                    emoji: '❤️',
                    user: { id: currentUserId },
                    message: { id: messageId },
                };

                mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
                mockMemberRepo.findOne.mockResolvedValueOnce({
                    id: 'mem-1',
                    user: { id: currentUserId, displayName: 'My Name' },
                });
                mockMessageRepo.findOne.mockResolvedValueOnce({ id: messageId, isRecalled: false });
                mockReactionRepo.findOne.mockResolvedValueOnce(existingReaction);
                mockReactionRepo.find.mockResolvedValueOnce([
                    {
                        id: 'r-1',
                        emoji: '🔥',
                        user: { id: currentUserId, displayName: 'My Name' },
                        message: { id: messageId },
                    },
                ]);

                const result = await service.reactMessage(currentUserId, conversationId, messageId, '🔥');

                expect(result.action).toBe('CHANGED');
                expect(result.emoji).toBe('🔥');
                expect(existingReaction.emoji).toBe('🔥');
                expect(mockReactionRepo.save).toHaveBeenCalledWith(existingReaction);
                expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                    'message.reaction_updated',
                    expect.objectContaining({
                        conversationId,
                        messageId,
                        emoji: '🔥',
                        action: 'CHANGED',
                    }),
                );
            });
        });

        describe('getMessages enrichment', () => {
            it('nên tổng hợp reactions và enrich replyTo context (bao gồm xử lý tombstone tin bị thu hồi)', async () => {
                mockConversationRepo.findOne.mockResolvedValueOnce({ id: conversationId });
                mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'mem-1' });

                const msgWithReplyAndReaction = {
                    id: 'msg-child',
                    content: 'Child msg',
                    replyToId: 'msg-parent-recalled',
                    createdAt: new Date('2026-10-14T10:00:00Z'),
                };

                mockMessageRepo.createQueryBuilder.mockReturnValue(
                    createMockQueryBuilder([msgWithReplyAndReaction]),
                );

                mockReactionRepo.find.mockResolvedValueOnce([
                    {
                        id: 'r-1',
                        emoji: '👍',
                        user: { id: otherUserId, displayName: 'Other User' },
                        message: { id: 'msg-child' },
                    },
                    {
                        id: 'r-2',
                        emoji: '👍',
                        user: { id: currentUserId, displayName: 'Me' },
                        message: { id: 'msg-child' },
                    },
                ]);

                mockMessageRepo.find.mockResolvedValueOnce([
                    {
                        id: 'msg-parent-recalled',
                        content: 'Original secret',
                        type: MessageType.TEXT,
                        fileUrl: 'https://secret.png',
                        isRecalled: true,
                        sender: {
                            id: otherUserId,
                            username: 'other',
                            displayName: 'Other',
                            avatarUrl: null,
                        },
                    },
                ]);

                const result = await service.getMessages(currentUserId, conversationId, { limit: 10 });

                expect(result).toHaveLength(1);
                const enriched = result[0] as any;
                // Check aggregated reactions
                expect(enriched.reactions).toHaveLength(1);
                expect(enriched.reactions[0]).toEqual({
                    emoji: '👍',
                    count: 2,
                    hasReacted: true,
                    users: [
                        { id: otherUserId, displayName: 'Other User' },
                        { id: currentUserId, displayName: 'Me' },
                    ],
                });
                // Check tombstoned replyTo
                expect(enriched.replyTo).toEqual({
                    id: 'msg-parent-recalled',
                    content: '[Tin nhắn đã bị thu hồi]',
                    type: MessageType.TEXT,
                    fileUrl: null,
                    sender: {
                        id: otherUserId,
                        username: 'other',
                        displayName: 'Other',
                        avatarUrl: null,
                    },
                });
            });
        });

        describe('createMessage with reply context', () => {
            it('nên lưu tin nhắn và đính kèm replyToSummary (tombstone nếu bị thu hồi)', async () => {
                mockMemberRepo.findOne.mockResolvedValue({ id: 'mem-1' });
                const parentMsg = {
                    id: 'parent-msg-id',
                    content: 'Hello parent',
                    type: MessageType.TEXT,
                    fileUrl: null,
                    isRecalled: false,
                    sender: { id: otherUserId, username: 'user2', displayName: 'User Two', avatarUrl: null },
                };
                mockMessageRepo.findOne.mockResolvedValueOnce(parentMsg);

                const savedMsg = {
                    id: 'new-msg-with-reply',
                    content: 'I reply to you',
                    type: MessageType.TEXT,
                    replyToId: parentMsg.id,
                    createdAt: new Date(),
                };
                mockMessageRepo.save.mockResolvedValue(savedMsg);
                mockMessageRepo.findOneOrFail.mockResolvedValue({
                    ...savedMsg,
                    sender: { id: currentUserId, username: 'user1', displayName: 'User One' },
                });

                const result = await service.createMessage(currentUserId, {
                    conversationId,
                    content: 'I reply to you',
                    type: MessageType.TEXT,
                    replyToId: parentMsg.id,
                });

                expect((result as any).replyTo).toEqual({
                    id: parentMsg.id,
                    content: 'Hello parent',
                    type: MessageType.TEXT,
                    fileUrl: null,
                    sender: {
                        id: otherUserId,
                        username: 'user2',
                        displayName: 'User Two',
                        avatarUrl: null,
                    },
                });
                expect((result as any).reactions).toEqual([]);
            });
        });
    });
});


