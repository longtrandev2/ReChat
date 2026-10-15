import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { User } from '../users/entities/user.entity.js';
import { ConversationRole } from './entities/conversation-member.entity.js';
import { MessageType } from './entities/message.entity.js';

describe('ConversationsController', () => {
    let controller: ConversationsController;
    let mockConversationsService: any;

    const mockCurrentUser = {
        id: 'user-current-id',
        username: 'currentUser',
    } as User;

    beforeEach(async () => {
        mockConversationsService = {
            getInbox: vi.fn(),
            createOrGetDirect: vi.fn(),
            createGroup: vi.fn(),
            addMembers: vi.fn(),
            leaveGroup: vi.fn(),
            getMessages: vi.fn(),
            markAsRead: vi.fn(),
            getConversationDetail: vi.fn(),
            updateGroup: vi.fn(),
            kickMember: vi.fn(),
            transferOwnership: vi.fn(),
            updateMemberRole: vi.fn(),
            pinMessage: vi.fn(),
            unpinMessage: vi.fn(),
            getPinnedMessages: vi.fn(),
            getMediaMessages: vi.fn(),
            getConversationActiveStatus: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ConversationsController],
            providers: [
                {
                    provide: ConversationsService,
                    useValue: mockConversationsService,
                },
            ],
        }).compile();

        controller = module.get<ConversationsController>(ConversationsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getInbox', () => {
        it('should delegate to service.getInbox with current user id', async () => {
            const mockInbox = [{ id: 'conv-1' }];
            mockConversationsService.getInbox.mockResolvedValue(mockInbox);

            const result = await controller.getInbox(mockCurrentUser);
            expect(mockConversationsService.getInbox).toHaveBeenCalledWith(mockCurrentUser.id);
            expect(result).toEqual(mockInbox);
        });
    });

    describe('createOrGetDirect', () => {
        it('should delegate to service.createOrGetDirect with targetUserId', async () => {
            const dto = { targetUserId: 'target-user-id' };
            const mockResult = { id: 'conv-direct' };
            mockConversationsService.createOrGetDirect.mockResolvedValue(mockResult);

            const result = await controller.createOrGetDirect(mockCurrentUser, dto);
            expect(mockConversationsService.createOrGetDirect).toHaveBeenCalledWith(mockCurrentUser.id, dto.targetUserId);
            expect(result).toEqual(mockResult);
        });
    });

    describe('createGroup', () => {
        it('should delegate to service.createGroup with dto', async () => {
            const dto = { name: 'New Group', memberIds: ['u-1', 'u-2'] };
            const mockResult = { id: 'conv-group' };
            mockConversationsService.createGroup.mockResolvedValue(mockResult);

            const result = await controller.createGroup(mockCurrentUser, dto);
            expect(mockConversationsService.createGroup).toHaveBeenCalledWith(mockCurrentUser.id, dto);
            expect(result).toEqual(mockResult);
        });
    });

    describe('addMembers', () => {
        it('should delegate to service.addMembers with conversationId and dto', async () => {
            const dto = { memberIds: ['u-3'] };
            const mockResult = { message: 'Added', addedCount: 1 };
            mockConversationsService.addMembers.mockResolvedValue(mockResult);

            const result = await controller.addMembers(mockCurrentUser, 'conv-1', dto);
            expect(mockConversationsService.addMembers).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', dto);
            expect(result).toEqual(mockResult);
        });
    });

    describe('leaveGroup', () => {
        it('should delegate to service.leaveGroup with conversationId', async () => {
            const mockResult = { message: 'Left group' };
            mockConversationsService.leaveGroup.mockResolvedValue(mockResult);

            const result = await controller.leaveGroup(mockCurrentUser, 'conv-1');
            expect(mockConversationsService.leaveGroup).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1');
            expect(result).toEqual(mockResult);
        });
    });

    describe('getMessages', () => {
        it('should delegate to service.getMessages with user id, conversationId, query', async () => {
            const query = { limit: 20 };
            const mockMessages = [{ id: 'msg-1' }];
            mockConversationsService.getMessages.mockResolvedValue(mockMessages);

            const result = await controller.getMessages(mockCurrentUser, 'conv-1', query);
            expect(mockConversationsService.getMessages).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', query);
            expect(result).toEqual(mockMessages);
        });
    });

    describe('markAsRead', () => {
        it('should delegate to service.markAsRead with user id, conversationId', async () => {
            const mockResult = { message: 'Marked read' };
            mockConversationsService.markAsRead.mockResolvedValue(mockResult);

            const result = await controller.markAsRead(mockCurrentUser, 'conv-1');
            expect(mockConversationsService.markAsRead).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1');
            expect(result).toEqual(mockResult);
        });
    });

    describe('getConversationDetail', () => {
        it('should delegate to service.getConversationDetail', async () => {
            const mockDetail = { id: 'conv-1', name: 'Group' };
            mockConversationsService.getConversationDetail.mockResolvedValue(mockDetail);

            const result = await controller.getConversationDetail(mockCurrentUser, 'conv-1');
            expect(mockConversationsService.getConversationDetail).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1');
            expect(result).toEqual(mockDetail);
        });
    });

    describe('updateGroup', () => {
        it('should delegate to service.updateGroup with dto', async () => {
            const dto = { name: 'Renamed' };
            const mockUpdated = { id: 'conv-1', name: 'Renamed' };
            mockConversationsService.updateGroup.mockResolvedValue(mockUpdated);

            const result = await controller.updateGroup(mockCurrentUser, 'conv-1', dto);
            expect(mockConversationsService.updateGroup).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', dto);
            expect(result).toEqual(mockUpdated);
        });
    });

    describe('kickMember', () => {
        it('should delegate to service.kickMember with targetUserId', async () => {
            const mockResult = { message: 'Kicked' };
            mockConversationsService.kickMember.mockResolvedValue(mockResult);

            const result = await controller.kickMember(mockCurrentUser, 'conv-1', 'user-target');
            expect(mockConversationsService.kickMember).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', 'user-target');
            expect(result).toEqual(mockResult);
        });
    });

    describe('transferOwnership', () => {
        it('should delegate to service.transferOwnership with dto', async () => {
            const dto = { newOwnerId: 'user-new-owner' };
            const mockResult = { message: 'Transferred' };
            mockConversationsService.transferOwnership.mockResolvedValue(mockResult);

            const result = await controller.transferOwnership(mockCurrentUser, 'conv-1', dto);
            expect(mockConversationsService.transferOwnership).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', dto);
            expect(result).toEqual(mockResult);
        });
    });

    describe('updateMemberRole', () => {
        it('should delegate to service.updateMemberRole with targetUserId and dto', async () => {
            const dto = { role: ConversationRole.ADMIN };
            const mockResult = { message: 'Updated role', member: { id: 'm-1', role: 'ADMIN' } };
            mockConversationsService.updateMemberRole.mockResolvedValue(mockResult);

            const result = await controller.updateMemberRole(mockCurrentUser, 'conv-1', 'user-target', dto);
            expect(mockConversationsService.updateMemberRole).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', 'user-target', dto);
            expect(result).toEqual(mockResult);
        });
    });

    describe('pinMessage', () => {
        it('should delegate to service.pinMessage with messageId', async () => {
            const mockPinned = { id: 'msg-1', isPinned: true };
            mockConversationsService.pinMessage.mockResolvedValue(mockPinned);

            const result = await controller.pinMessage(mockCurrentUser, 'conv-1', 'msg-1');
            expect(mockConversationsService.pinMessage).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', 'msg-1');
            expect(result).toEqual(mockPinned);
        });
    });

    describe('unpinMessage', () => {
        it('should delegate to service.unpinMessage with messageId', async () => {
            const mockResult = { message: 'Unpinned' };
            mockConversationsService.unpinMessage.mockResolvedValue(mockResult);

            const result = await controller.unpinMessage(mockCurrentUser, 'conv-1', 'msg-1');
            expect(mockConversationsService.unpinMessage).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', 'msg-1');
            expect(result).toEqual(mockResult);
        });
    });

    describe('getPinnedMessages', () => {
        it('should delegate to service.getPinnedMessages', async () => {
            const mockList = [{ id: 'msg-p1' }];
            mockConversationsService.getPinnedMessages.mockResolvedValue(mockList);

            const result = await controller.getPinnedMessages(mockCurrentUser, 'conv-1');
            expect(mockConversationsService.getPinnedMessages).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1');
            expect(result).toEqual(mockList);
        });
    });

    describe('getMediaMessages', () => {
        it('should delegate to service.getMediaMessages with query', async () => {
            const query = { type: MessageType.IMAGE, limit: 15 };
            const mockList = [{ id: 'msg-media-1' }];
            mockConversationsService.getMediaMessages.mockResolvedValue(mockList);

            const result = await controller.getMediaMessages(mockCurrentUser, 'conv-1', query);
            expect(mockConversationsService.getMediaMessages).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1', query);
            expect(result).toEqual(mockList);
        });
    });

    describe('getConversationActiveStatus', () => {
        it('should delegate to service.getConversationActiveStatus', async () => {
            const mockStatus = { conversationId: 'conv-1', isActive: true, activeMemberCount: 2, totalMemberCount: 4 };
            mockConversationsService.getConversationActiveStatus.mockResolvedValue(mockStatus);

            const result = await controller.getConversationActiveStatus(mockCurrentUser, 'conv-1');
            expect(mockConversationsService.getConversationActiveStatus).toHaveBeenCalledWith(mockCurrentUser.id, 'conv-1');
            expect(result).toEqual(mockStatus);
        });
    });
});
