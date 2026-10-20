import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ChatGateway } from './chat.gateway.js';
import { ConnectionManagerService } from './connection-manager.service.js';
import { ConversationsService } from '../conversations.service.js';
import { MessageType } from '../entities/message.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Friendship, FriendshipStatus } from '../../friends/entities/friendship.entity.js';
import { Socket } from 'socket.io';
import {
    FriendRequestSentEvent,
    FriendRequestAcceptedEvent,
    FriendRequestRejectedEvent,
    FriendRequestCancelledEvent,
    FriendRemovedEvent,
    ConversationCreatedEvent,
    InboxUpdatedEvent,
    GroupMemberEvent,
    MessagePinnedEvent,
    MessageRecalledEvent,
    MessageEditedEvent,
    MessageReactionEvent,
} from '../../../common/events/index.js';

describe('ChatGateway - Layer 1, 2 & 3 (Auth, Presence, Rooms & Messaging)', () => {
    let gateway: ChatGateway;
    let mockJwtService: {
        verifyAsync: ReturnType<typeof vi.fn>;
    };
    let mockConnectionManager: {
        addConnection: ReturnType<typeof vi.fn>;
        removeConnection: ReturnType<typeof vi.fn>;
        getUserSockets: ReturnType<typeof vi.fn>;
        isUserOnline: ReturnType<typeof vi.fn>;
    };
    let mockConversationsService: {
        validateMembership: ReturnType<typeof vi.fn>;
        createMessage: ReturnType<typeof vi.fn>;
        markAsRead: ReturnType<typeof vi.fn>;
        recallMessage: ReturnType<typeof vi.fn>;
        editMessage: ReturnType<typeof vi.fn>;
        reactMessage: ReturnType<typeof vi.fn>;
    };
    let mockUserRepository: {
        update: ReturnType<typeof vi.fn>;
    };
    let mockFriendshipRepository: {
        find: ReturnType<typeof vi.fn>;
    };
    let mockServer: {
        to: ReturnType<typeof vi.fn>;
        emit: ReturnType<typeof vi.fn>;
    };

    const createMockSocket = (auth?: any, headers?: any): Partial<Socket> => {
        const toEmit = vi.fn();
        return {
            id: 'mock-socket-id-123',
            handshake: {
                auth: auth || {},
                headers: headers || {},
                query: {},
                time: new Date().toISOString(),
                address: '127.0.0.1',
                xdomain: false,
                secure: false,
                issued: Date.now(),
                url: '/socket.io/',
            } as any,
            data: {},
            join: vi.fn().mockResolvedValue(undefined),
            leave: vi.fn().mockResolvedValue(undefined),
            to: vi.fn().mockReturnValue({ emit: toEmit }),
            emit: vi.fn(),
            disconnect: vi.fn(),
        };
    };

    beforeEach(async () => {
        mockJwtService = {
            verifyAsync: vi.fn(),
        };

        mockConnectionManager = {
            addConnection: vi.fn().mockReturnValue({ isFirstConnection: true, totalConnections: 1 }),
            removeConnection: vi.fn().mockReturnValue({ isLastConnection: true, remainingConnections: 0 }),
            getUserSockets: vi.fn().mockReturnValue(new Set()),
            isUserOnline: vi.fn().mockReturnValue(false),
        };

        mockConversationsService = {
            validateMembership: vi.fn().mockResolvedValue({ id: 'mem-1' }),
            createMessage: vi.fn(),
            markAsRead: vi.fn(),
            recallMessage: vi.fn(),
            editMessage: vi.fn(),
            reactMessage: vi.fn(),
        };

        mockUserRepository = {
            findOne: vi.fn().mockResolvedValue({
                id: 'user-uuid-1',
                username: 'john_doe',
                displayName: 'John Doe',
                avatarUrl: 'https://avatar.url',
            }),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
        };

        mockFriendshipRepository = {
            find: vi.fn().mockResolvedValue([]),
        };

        mockServer = {
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: ConnectionManagerService,
                    useValue: mockConnectionManager,
                },
                {
                    provide: ConversationsService,
                    useValue: mockConversationsService,
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: getRepositoryToken(Friendship),
                    useValue: mockFriendshipRepository,
                },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
        gateway.server = mockServer as any;
    });


    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('Layer 1: Handshake Authentication (BR-11)', () => {
        it('should disconnect and emit exception if token is missing', async () => {
            const client = createMockSocket({}, {}) as Socket;

            await gateway.handleConnection(client);

            expect(client.emit).toHaveBeenCalledWith('exception', {
                status: 'error',
                message: 'Unauthorized: Missing authentication token',
            });
            expect(client.disconnect).toHaveBeenCalledWith(true);
            expect(client.data.user).toBeUndefined();
            expect(mockConnectionManager.addConnection).not.toHaveBeenCalled();
        });

        it('should disconnect and emit exception if JWT token is invalid or expired', async () => {
            const client = createMockSocket({ token: 'invalid.jwt.token' }) as Socket;
            mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

            await gateway.handleConnection(client);

            expect(client.emit).toHaveBeenCalledWith('exception', {
                status: 'error',
                message: 'Unauthorized: Invalid or expired token',
            });
            expect(client.disconnect).toHaveBeenCalledWith(true);
            expect(client.data.user).toBeUndefined();
            expect(mockConnectionManager.addConnection).not.toHaveBeenCalled();
        });

        it('should authenticate successfully with token from handshake.auth.token', async () => {
            const client = createMockSocket({ token: 'Bearer valid.jwt.token' }) as Socket;
            const mockPayload = { sub: 'user-uuid-1', username: 'john_doe' };
            mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

            await gateway.handleConnection(client);

            expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt.token');
            expect(client.disconnect).not.toHaveBeenCalled();
            expect(client.data.user).toEqual({
                id: 'user-uuid-1',
                username: 'john_doe',
                displayName: 'John Doe',
                avatarUrl: 'https://avatar.url',
            });
        });

        it('should authenticate successfully with token from handshake.headers.authorization', async () => {
            const client = createMockSocket(
                {},
                { authorization: 'Bearer header.jwt.token' },
            ) as Socket;
            const mockPayload = { id: 'user-uuid-2', username: 'jane_doe' };
            mockJwtService.verifyAsync.mockResolvedValue(mockPayload);
            mockUserRepository.findOne.mockResolvedValueOnce({
                id: 'user-uuid-2',
                username: 'jane_doe',
                displayName: 'Jane Doe',
                avatarUrl: null,
            });

            await gateway.handleConnection(client);

            expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('header.jwt.token');
            expect(client.disconnect).not.toHaveBeenCalled();
            expect(client.data.user).toEqual({
                id: 'user-uuid-2',
                username: 'jane_doe',
                displayName: 'Jane Doe',
                avatarUrl: null,
            });
        });
    });

    describe('Layer 2: Multi-device & Presence Management', () => {
        const userId = 'user-uuid-1';
        const clientToken = { token: 'valid.token' };

        beforeEach(() => {
            mockJwtService.verifyAsync.mockResolvedValue({
                sub: userId,
                username: 'john_doe',
            });
        });

        it('should join personal room user_{userId} upon successful connection', async () => {
            const client = createMockSocket(clientToken) as Socket;

            await gateway.handleConnection(client);

            expect(client.join).toHaveBeenCalledWith(`user_${userId}`);
            expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(userId, client.id);
        });

        it('should mark user ONLINE in DB and broadcast userPresence when isFirstConnection is true', async () => {
            const client = createMockSocket(clientToken) as Socket;
            mockConnectionManager.addConnection.mockReturnValue({
                isFirstConnection: true,
                totalConnections: 1,
            });

            // Mock 2 friends: one where user is requester, one where user is addressee
            mockFriendshipRepository.find.mockResolvedValue([
                { requester: { id: userId }, addressee: { id: 'friend-1' }, status: FriendshipStatus.ACCEPTED },
                { requester: { id: 'friend-2' }, addressee: { id: userId }, status: FriendshipStatus.ACCEPTED },
            ]);

            await gateway.handleConnection(client);

            // 1. Cập nhật DB
            expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { isOnline: true });

            // 2. Broadcast đến bạn bè
            expect(mockFriendshipRepository.find).toHaveBeenCalledWith({
                where: [
                    { requester: { id: userId }, status: FriendshipStatus.ACCEPTED },
                    { addressee: { id: userId }, status: FriendshipStatus.ACCEPTED },
                ],
                relations: { requester: true, addressee: true },
                select: {
                    id: true,
                    requester: { id: true },
                    addressee: { id: true },
                },
            });

            expect(mockServer.to).toHaveBeenCalledWith('user_friend-1');
            expect(mockServer.to).toHaveBeenCalledWith('user_friend-2');
            expect(mockServer.emit).toHaveBeenCalledWith('userPresence', {
                userId,
                isOnline: true,
                lastSeen: expect.any(Date),
            });
        });

        it('should NOT update DB or broadcast presence if user opens a secondary tab (isFirstConnection = false)', async () => {
            const client = createMockSocket(clientToken) as Socket;
            mockConnectionManager.addConnection.mockReturnValue({
                isFirstConnection: false,
                totalConnections: 2,
            });

            await gateway.handleConnection(client);

            expect(client.join).toHaveBeenCalledWith(`user_${userId}`);
            expect(mockUserRepository.update).not.toHaveBeenCalled();
            expect(mockFriendshipRepository.find).not.toHaveBeenCalled();
            expect(mockServer.emit).not.toHaveBeenCalled();
        });

        it('should NOT mark user offline if user closes 1 tab but has other tabs open (isLastConnection = false)', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = { id: userId, username: 'john_doe' };
            mockConnectionManager.removeConnection.mockReturnValue({
                isLastConnection: false,
                remainingConnections: 1,
            });

            await gateway.handleDisconnect(client);

            expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(userId, client.id);
            expect(mockUserRepository.update).not.toHaveBeenCalled();
            expect(mockFriendshipRepository.find).not.toHaveBeenCalled();
            expect(mockServer.emit).not.toHaveBeenCalled();
        });

        it('should mark user OFFLINE in DB with lastSeen and broadcast presence when closing the last tab (isLastConnection = true)', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = { id: userId, username: 'john_doe' };
            mockConnectionManager.removeConnection.mockReturnValue({
                isLastConnection: true,
                remainingConnections: 0,
            });

            mockFriendshipRepository.find.mockResolvedValue([
                { requester: { id: userId }, addressee: { id: 'friend-1' }, status: FriendshipStatus.ACCEPTED },
            ]);

            await gateway.handleDisconnect(client);

            expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(userId, client.id);
            expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
                isOnline: false,
                lastSeen: expect.any(Date),
            });

            expect(mockServer.to).toHaveBeenCalledWith('user_friend-1');
            expect(mockServer.emit).toHaveBeenCalledWith('userPresence', {
                userId,
                isOnline: false,
                lastSeen: expect.any(Date),
            });
        });

        it('should handle disconnect gracefully if socket was unauthenticated (no user on socket.data)', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = undefined;

            await gateway.handleDisconnect(client);

            expect(mockConnectionManager.removeConnection).not.toHaveBeenCalled();
            expect(mockUserRepository.update).not.toHaveBeenCalled();
        });
    });

    describe('Layer 3: Room Management & Realtime Messaging', () => {
        const userId = 'user-uuid-1';
        const conversationId = 'conv-uuid-1';

        describe('handleJoinConversation (BR-08)', () => {
            it('should throw WsException if socket has no authenticated user', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = undefined;

                await expect(
                    gateway.handleJoinConversation(client, { conversationId }),
                ).rejects.toThrow(WsException);
            });

            it('should throw BadRequestException if conversationId is missing', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };

                await expect(
                    gateway.handleJoinConversation(client, { conversationId: '' }),
                ).rejects.toThrow(BadRequestException);
            });

            it('should throw ForbiddenException if user is not a member of conversation (BR-08)', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };
                mockConversationsService.validateMembership.mockRejectedValue(
                    new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này'),
                );

                await expect(
                    gateway.handleJoinConversation(client, { conversationId }),
                ).rejects.toThrow(ForbiddenException);
            });

            it('should join conv_${conversationId} room and return success when member is valid', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };
                mockConversationsService.validateMembership.mockResolvedValue({ id: 'mem-1' });

                const result = await gateway.handleJoinConversation(client, { conversationId });

                expect(mockConversationsService.validateMembership).toHaveBeenCalledWith(
                    conversationId,
                    userId,
                );
                expect(client.join).toHaveBeenCalledWith(`conv_${conversationId}`);
                expect(result).toEqual({
                    status: 'success',
                    conversationId,
                });
            });
        });

        describe('handleLeaveConversation', () => {
            it('should leave conv_${conversationId} room and return success', async () => {
                const client = createMockSocket() as Socket;

                const result = await gateway.handleLeaveConversation(client, { conversationId });

                expect(client.leave).toHaveBeenCalledWith(`conv_${conversationId}`);
                expect(result).toEqual({
                    status: 'success',
                    conversationId,
                });
            });

            it('should return success even if conversationId is undefined', async () => {
                const client = createMockSocket() as Socket;

                const result = await gateway.handleLeaveConversation(client, {} as any);

                expect(client.leave).not.toHaveBeenCalled();
                expect(result.status).toBe('success');
            });
        });

        describe('handleSendMessage (FR-15, BR-08, BR-09, BR-10)', () => {
            const sendMessageDto = {
                conversationId,
                content: 'Hello, real-time message!',
                type: MessageType.TEXT,
            };

            it('should throw WsException if socket has no authenticated user', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = undefined;

                await expect(
                    gateway.handleSendMessage(client, sendMessageDto),
                ).rejects.toThrow(WsException);
            });

            it('should save message to DB, broadcast newMessage to room, and return ACK (SSOT)', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };

                const mockSavedMessage = {
                    id: 'msg-uuid-999',
                    content: sendMessageDto.content,
                    type: MessageType.TEXT,
                    fileUrl: undefined,
                    replyToId: undefined,
                    isRecalled: false,
                    isPinned: false,
                    createdAt: new Date('2026-10-15T03:30:00.000Z'),
                    sender: {
                        id: userId,
                        username: 'john_doe',
                        displayName: 'John Doe',
                        avatarUrl: 'https://avatar.url',
                    },
                };
                mockConversationsService.createMessage.mockResolvedValue(mockSavedMessage);

                const result = await gateway.handleSendMessage(client, sendMessageDto);

                // 1. Verify DB service was called (SSOT: Lưu DB trước)
                expect(mockConversationsService.createMessage).toHaveBeenCalledWith(
                    userId,
                    sendMessageDto,
                );

                // 2. Verify broadcast newMessage to conv_${conversationId} (cho cả sender & members)
                expect(mockServer.to).toHaveBeenCalledWith(`conv_${conversationId}`);
                expect(mockServer.emit).toHaveBeenCalledWith('newMessage', {
                    id: mockSavedMessage.id,
                    conversationId,
                    content: mockSavedMessage.content,
                    type: mockSavedMessage.type,
                    fileUrl: undefined,
                    replyToId: undefined,
                    replyTo: null,
                    reactions: [],
                    isRecalled: false,
                    isEdited: undefined,
                    editedAt: undefined,
                    isPinned: false,
                    createdAt: mockSavedMessage.createdAt,
                    sender: mockSavedMessage.sender,
                });

                // 3. Verify ACK returned to sender socket
                expect(result).toEqual({
                    status: 'success',
                    data: expect.objectContaining({
                        id: 'msg-uuid-999',
                        conversationId,
                    }),
                });
            });

            it('should propagate ForbiddenException if user is not in the conversation', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };

                mockConversationsService.createMessage.mockRejectedValue(
                    new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này'),
                );

                await expect(
                    gateway.handleSendMessage(client, sendMessageDto),
                ).rejects.toThrow(ForbiddenException);

                expect(mockServer.emit).not.toHaveBeenCalled();
            });
        });
    });

    describe('Layer 4: Typing Indicator & Read Receipts', () => {
        const userId = 'user-uuid-1';
        const conversationId = 'conv-uuid-1';

        describe('handleTyping', () => {
            it('should throw WsException if client is not authenticated', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = undefined;

                await expect(
                    gateway.handleTyping(client, { conversationId, isTyping: true }),
                ).rejects.toThrow(WsException);
            });

            it('should broadcast userTyping to other members in room (client.to) with isTyping: true', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };

                const result = await gateway.handleTyping(client, { conversationId, isTyping: true });

                expect(client.to).toHaveBeenCalledWith(`conv_${conversationId}`);
                expect(result).toEqual({ status: 'success' });
            });

            it('should broadcast userTyping with isTyping: false when user stops typing', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };

                const result = await gateway.handleTyping(client, { conversationId, isTyping: false });

                expect(client.to).toHaveBeenCalledWith(`conv_${conversationId}`);
                expect(result).toEqual({ status: 'success' });
            });
        });

        describe('handleMarkAsRead (FR-16, BR-10)', () => {
            it('should throw WsException if client is not authenticated', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = undefined;

                await expect(
                    gateway.handleMarkAsRead(client, { conversationId }),
                ).rejects.toThrow(WsException);
            });

            it('should call conversationsService.markAsRead, broadcast messageRead to room, and return ACK', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = {
                    id: userId,
                    username: 'john_doe',
                    displayName: 'John Doe',
                    avatarUrl: 'https://avatar.url',
                };

                const mockResult = {
                    message: 'Đã đánh dấu đã đọc thành công',
                    lastReadMessageId: 'latest-msg-uuid',
                };
                mockConversationsService.markAsRead.mockResolvedValue(mockResult);

                const result = await gateway.handleMarkAsRead(client, { conversationId });

                // 1. Verify service was called with current user and conv
                expect(mockConversationsService.markAsRead).toHaveBeenCalledWith(userId, conversationId);

                // 2. Verify broadcast messageRead to conv_${conversationId}
                expect(mockServer.to).toHaveBeenCalledWith(`conv_${conversationId}`);
                expect(mockServer.emit).toHaveBeenCalledWith('messageRead', {
                    conversationId,
                    userId,
                    username: 'john_doe',
                    displayName: 'John Doe',
                    avatarUrl: 'https://avatar.url',
                    lastReadMessageId: 'latest-msg-uuid',
                });

                // 3. Return ACK
                expect(result).toEqual({
                    status: 'success',
                    data: mockResult,
                });
            });

            it('should propagate ForbiddenException if user is not in conversation', async () => {
                const client = createMockSocket() as Socket;
                client.data.user = { id: userId, username: 'john_doe' };

                mockConversationsService.markAsRead.mockRejectedValue(
                    new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này'),
                );

                await expect(
                    gateway.handleMarkAsRead(client, { conversationId }),
                ).rejects.toThrow(ForbiddenException);

                expect(mockServer.emit).not.toHaveBeenCalled();
            });
        });
    });

    // =========================================================================
    // LAYER 4: NOTIFICATION EVENT LISTENERS (In-App Event Bus)
    // =========================================================================
    describe('Notification Event Listeners (In-App Event Bus)', () => {
        beforeEach(() => {
            gateway.server = mockServer as any;
        });

        it('handleFriendRequestSent should emit friendRequestReceived to recipient room', () => {
            const event = new FriendRequestSentEvent(
                'req-1',
                { id: 'u1', username: 'alex', displayName: 'Alex' },
                'u2',
                new Date(),
            );

            gateway.handleFriendRequestSent(event);

            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'friendRequestReceived',
                expect.objectContaining({
                    requestId: 'req-1',
                    requester: expect.objectContaining({ username: 'alex' }),
                }),
            );
        });

        it('handleFriendRequestAccepted should emit friendRequestAccepted to requester room', () => {
            const event = new FriendRequestAcceptedEvent(
                'f-1',
                'u1',
                { id: 'u2', username: 'bob', displayName: 'Bob', isOnline: true },
                new Date(),
            );

            gateway.handleFriendRequestAccepted(event);

            expect(mockServer.to).toHaveBeenCalledWith('user_u1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'friendRequestAccepted',
                expect.objectContaining({
                    friendshipId: 'f-1',
                    friend: expect.objectContaining({ username: 'bob' }),
                }),
            );
        });

        it('handleFriendRequestRejected should emit friendRequestRejected to requester room', () => {
            const event = new FriendRequestRejectedEvent('req-1', 'u1');

            gateway.handleFriendRequestRejected(event);

            expect(mockServer.to).toHaveBeenCalledWith('user_u1');
            expect(mockServer.emit).toHaveBeenCalledWith('friendRequestRejected', { requestId: 'req-1' });
        });

        it('handleFriendRequestCancelled should emit friendRequestCancelled to addressee room', () => {
            const event = new FriendRequestCancelledEvent('req-1', 'u2');

            gateway.handleFriendRequestCancelled(event);

            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.emit).toHaveBeenCalledWith('friendRequestCancelled', { requestId: 'req-1' });
        });

        it('handleFriendRemoved should emit friendRemoved to both users', () => {
            const event = new FriendRemovedEvent('u1', 'u2');

            gateway.handleFriendRemoved(event);

            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.to).toHaveBeenCalledWith('user_u1');
            expect(mockServer.emit).toHaveBeenCalledWith('friendRemoved', { friendId: 'u1' });
            expect(mockServer.emit).toHaveBeenCalledWith('friendRemoved', { friendId: 'u2' });
        });

        it('handleConversationCreated should emit conversationCreated to all member personal rooms', () => {
            const event = new ConversationCreatedEvent('conv-1', ['u1', 'u2'], { id: 'conv-1' });

            gateway.handleConversationCreated(event);

            expect(mockServer.to).toHaveBeenCalledWith('user_u1');
            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.emit).toHaveBeenCalledWith('conversationCreated', { id: 'conv-1' });
        });

        it('handleInboxUpdated should emit conversationUpdated to all member personal rooms', () => {
            const event = new InboxUpdatedEvent(
                'conv-1',
                ['u1', 'u2'],
                { id: 'msg-1', content: 'hello', type: 'TEXT', senderName: 'Alex', createdAt: new Date() },
                'u1',
            );

            gateway.handleInboxUpdated(event);

            expect(mockServer.to).toHaveBeenCalledWith('user_u1');
            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'conversationUpdated',
                expect.objectContaining({
                    conversationId: 'conv-1',
                    senderId: 'u1',
                }),
            );
        });

        it('handleGroupMemberEvent should emit groupMemberUpdated to conversation room and groupMembershipChanged to affected users', () => {
            const event = new GroupMemberEvent(
                'conv-1',
                'ADDED',
                { id: 'u1', displayName: 'Admin' },
                ['u2'],
            );

            gateway.handleGroupMemberEvent(event);

            expect(mockServer.to).toHaveBeenCalledWith('conv_conv-1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'groupMemberUpdated',
                expect.objectContaining({
                    conversationId: 'conv-1',
                    action: 'ADDED',
                }),
            );
            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'groupMembershipChanged',
                expect.objectContaining({
                    conversationId: 'conv-1',
                    action: 'ADDED',
                }),
            );
        });

        it('handleMessagePinned should emit messagePinned when pinned and messageUnpinned when unpinned', () => {
            const pinEvent = new MessagePinnedEvent(
                'conv-1',
                'msg-1',
                true,
                { id: 'msg-1', content: 'Pinned text' },
                { id: 'u1', displayName: 'Admin' },
            );

            gateway.handleMessagePinned(pinEvent);

            expect(mockServer.to).toHaveBeenCalledWith('conv_conv-1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'messagePinned',
                expect.objectContaining({
                    messageId: 'msg-1',
                }),
            );

            const unpinEvent = new MessagePinnedEvent('conv-1', 'msg-1', false);
            gateway.handleMessagePinned(unpinEvent);

            expect(mockServer.to).toHaveBeenCalledWith('conv_conv-1');
            expect(mockServer.emit).toHaveBeenCalledWith('messageUnpinned', {
                conversationId: 'conv-1',
                messageId: 'msg-1',
            });
        });

        it('handleMessageRecalled should emit messageRecalled to room and conversationUpdated if last message', () => {
            const recallEvent = new MessageRecalledEvent(
                'conv-1',
                'msg-1',
                new Date(),
                'u1',
                true,
                ['u1', 'u2'],
            );

            gateway.handleMessageRecalled(recallEvent);

            expect(mockServer.to).toHaveBeenCalledWith('conv_conv-1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'messageRecalled',
                expect.objectContaining({
                    conversationId: 'conv-1',
                    messageId: 'msg-1',
                }),
            );

            expect(mockServer.to).toHaveBeenCalledWith('user_u1');
            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'conversationUpdated',
                expect.objectContaining({
                    conversationId: 'conv-1',
                    lastMessage: expect.objectContaining({
                        isRecalled: true,
                    }),
                }),
            );
        });

        it('handleMessageEdited should emit messageEdited to room and conversationUpdated if last message', () => {
            const editEvent = new MessageEditedEvent(
                'conv-1',
                'msg-1',
                'Nội dung mới',
                new Date(),
                'u1',
                true,
                ['u1', 'u2'],
            );

            gateway.handleMessageEdited(editEvent);

            expect(mockServer.to).toHaveBeenCalledWith('conv_conv-1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'messageEdited',
                expect.objectContaining({
                    conversationId: 'conv-1',
                    messageId: 'msg-1',
                    content: 'Nội dung mới',
                    isEdited: true,
                }),
            );

            expect(mockServer.to).toHaveBeenCalledWith('user_u1');
            expect(mockServer.to).toHaveBeenCalledWith('user_u2');
            expect(mockServer.emit).toHaveBeenCalledWith(
                'conversationUpdated',
                expect.objectContaining({
                    conversationId: 'conv-1',
                    lastMessage: expect.objectContaining({
                        content: 'Nội dung mới',
                        isEdited: true,
                    }),
                }),
            );
        });

        it('handleMessageReactionUpdated should emit messageReactionUpdated to conversation room', () => {
            const reactionEvent = new MessageReactionEvent(
                'conv-1',
                'msg-1',
                { id: 'u1', displayName: 'User One', avatarUrl: 'avatar.png' },
                '❤️',
                'ADDED',
            );

            gateway.handleMessageReactionUpdated(reactionEvent);

            expect(mockServer.to).toHaveBeenCalledWith('conv_conv-1');
            expect(mockServer.emit).toHaveBeenCalledWith('messageReactionUpdated', {
                conversationId: 'conv-1',
                messageId: 'msg-1',
                user: { id: 'u1', displayName: 'User One', avatarUrl: 'avatar.png' },
                emoji: '❤️',
                action: 'ADDED',
            });
        });
    });

    describe('handleRecallMessage & handleEditMessage socket handlers', () => {
        it('handleRecallMessage should throw WsException if client has no authenticated user', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = undefined;

            await expect(
                gateway.handleRecallMessage(client, { conversationId: 'conv-1', messageId: 'msg-1' }),
            ).rejects.toThrow(WsException);
        });

        it('handleRecallMessage should recall message and return success response', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = { id: 'user-uuid-1', username: 'john_doe' };

            mockConversationsService.recallMessage.mockResolvedValueOnce({
                id: 'msg-1',
                isRecalled: true,
                content: '[Tin nhắn đã bị thu hồi]',
            });

            const result = await gateway.handleRecallMessage(client, {
                conversationId: 'conv-1',
                messageId: 'msg-1',
            });

            expect(mockConversationsService.recallMessage).toHaveBeenCalledWith(
                'user-uuid-1',
                'conv-1',
                'msg-1',
            );
            expect(result.status).toBe('success');
            expect(result.data.isRecalled).toBe(true);
        });

        it('handleEditMessage should throw WsException if client has no authenticated user', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = undefined;

            await expect(
                gateway.handleEditMessage(client, {
                    conversationId: 'conv-1',
                    messageId: 'msg-1',
                    content: 'Nội dung mới',
                }),
            ).rejects.toThrow(WsException);
        });

        it('handleEditMessage should edit message and return success response', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = { id: 'user-uuid-1', username: 'john_doe' };

            mockConversationsService.editMessage.mockResolvedValueOnce({
                id: 'msg-1',
                content: 'Nội dung mới',
                isEdited: true,
                editedAt: new Date(),
            });

            const result = await gateway.handleEditMessage(client, {
                conversationId: 'conv-1',
                messageId: 'msg-1',
                content: 'Nội dung mới',
            });

            expect(mockConversationsService.editMessage).toHaveBeenCalledWith(
                'user-uuid-1',
                'conv-1',
                'msg-1',
                'Nội dung mới',
            );
            expect(result.status).toBe('success');
            expect(result.data.content).toBe('Nội dung mới');
            expect(result.data.isEdited).toBe(true);
        });

        it('handleReactMessage should throw WsException if client has no authenticated user', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = undefined;

            await expect(
                gateway.handleReactMessage(client, {
                    conversationId: 'conv-1',
                    messageId: 'msg-1',
                    emoji: '❤️',
                }),
            ).rejects.toThrow(WsException);
        });

        it('handleReactMessage should throw BadRequestException if parameters are missing', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = { id: 'user-uuid-1', username: 'john_doe' };

            await expect(
                gateway.handleReactMessage(client, {
                    conversationId: '',
                    messageId: 'msg-1',
                    emoji: '❤️',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('handleReactMessage should delegate to service.reactMessage and return success response', async () => {
            const client = createMockSocket() as Socket;
            client.data.user = { id: 'user-uuid-1', username: 'john_doe' };

            const mockReactionResult = {
                action: 'ADDED' as const,
                emoji: '❤️',
                messageId: 'msg-1',
                reactions: [{ emoji: '❤️', count: 1, users: [{ id: 'user-uuid-1', displayName: 'John Doe' }], hasReacted: true }],
            };
            mockConversationsService.reactMessage.mockResolvedValueOnce(mockReactionResult);

            const result = await gateway.handleReactMessage(client, {
                conversationId: 'conv-1',
                messageId: 'msg-1',
                emoji: '❤️',
            });

            expect(mockConversationsService.reactMessage).toHaveBeenCalledWith(
                'user-uuid-1',
                'conv-1',
                'msg-1',
                '❤️',
            );
            expect(result.status).toBe('success');
            expect(result.data).toEqual(mockReactionResult);
        });
    });
});




