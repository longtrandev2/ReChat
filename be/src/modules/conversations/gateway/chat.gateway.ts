import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WsException,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsExceptionsFilter } from './ws-exception.filter.js';
import { ConnectionManagerService } from './connection-manager.service.js';
import { ConversationsService } from '../conversations.service.js';
import {
    SendMessageDto,
    JoinConversationDto,
    TypingDto,
    MarkAsReadDto,
    RecallMessageDto,
    EditMessageDto,
    ReactMessageDto,
} from '../dto/index.js';
import { User } from '../../users/entities/user.entity.js';
import { Friendship, FriendshipStatus } from '../../friends/entities/friendship.entity.js';
import { OnEvent } from '@nestjs/event-emitter';
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
    MessageCreatedEvent,
} from '../../../common/events/index.js';

@WebSocketGateway({
    cors: {
        origin: true,
        credentials: true,
    },
})
@UseFilters(new WsExceptionsFilter())
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatGateway.name);

    @WebSocketServer()
    server: Server;

    constructor(
        private readonly jwtService: JwtService,
        private readonly connectionManager: ConnectionManagerService,
        private readonly conversationsService: ConversationsService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Friendship)
        private readonly friendshipRepository: Repository<Friendship>,
    ) { }

    afterInit(_server: Server) {
        this.logger.log('🚀 WebSocket ChatGateway đã được khởi tạo thành công');
    }

    /**
     * Xác thực kết nối WebSocket tại thời điểm Handshake (BR-11)
     * Client truyền JWT qua client.handshake.auth.token hoặc headers.authorization
     */
    async handleConnection(client: Socket): Promise<void> {
        try {
            // 1. Lấy token từ auth object hoặc headers
            const rawToken =
                client.handshake.auth?.token ||
                client.handshake.headers?.authorization ||
                client.handshake.query?.token;

            if (!rawToken || typeof rawToken !== 'string') {
                this.logger.warn(`[Handshake] Kết nối bị từ chối (Socket ${client.id}): Thiếu JWT token`);
                client.emit('exception', {
                    status: 'error',
                    message: 'Unauthorized: Missing authentication token',
                });
                client.disconnect(true);
                return;
            }

            // 2. Chuẩn hóa chuỗi token (loại bỏ tiền tố 'Bearer ' nếu có)
            const token = rawToken.startsWith('Bearer ')
                ? rawToken.slice(7).trim()
                : rawToken.trim();

            // 3. Giải mã và xác thực chữ ký JWT
            const payload = await this.jwtService.verifyAsync(token);

            // 4. Lưu thông tin User (kèm displayName, avatarUrl) vào session stateful của Socket (client.data)
            const userId = payload.sub || payload.id;
            const dbUser = await this.userRepository.findOne({
                where: { id: userId },
                select: { id: true, username: true, displayName: true, avatarUrl: true },
            });

            client.data.user = {
                id: userId,
                username: payload.username,
                displayName: dbUser?.displayName || payload.username,
                avatarUrl: dbUser?.avatarUrl || null,
            };

            // 5. Gia nhập personal room để nhận event broadcast riêng (multi-tab/device)
            await client.join(`user_${userId}`);

            // 6. Đăng ký socket vào ConnectionManager (RAM registry)
            const { isFirstConnection, totalConnections } = this.connectionManager.addConnection(
                userId,
                client.id,
            );

            // 7. Nếu là thiết bị/tab đầu tiên kết nối: User chuyển từ Offline sang Online
            if (isFirstConnection) {
                await this.userRepository.update(userId, { isOnline: true });
                await this.broadcastPresence(userId, true);
            }

            this.logger.log(
                `[Handshake] Kết nối thành công: Socket ${client.id} - User ${client.data.user.username} (${userId}) [Active tabs: ${totalConnections}]`,
            );
        } catch (error) {
            this.logger.warn(
                `[Handshake] Xác thực thất bại (Socket ${client.id}): ${(error as Error).message}`,
            );
            client.emit('exception', {
                status: 'error',
                message: 'Unauthorized: Invalid or expired token',
            });
            client.disconnect(true);
        }
    }

    /**
     * Xử lý khi Socket ngắt kết nối (tắt tab, rớt mạng, client disconnect)
     */
    async handleDisconnect(client: Socket): Promise<void> {
        const user = client.data?.user;
        if (!user?.id) {
            this.logger.log(`[Disconnect] Socket ${client.id} (Guest/Unauth) đã ngắt kết nối`);
            return;
        }

        const userId = user.id;
        const { isLastConnection, remainingConnections } = this.connectionManager.removeConnection(
            userId,
            client.id,
        );

        this.logger.log(
            `[Disconnect] Socket ${client.id} đã ngắt kết nối (User: ${user.username || userId}) [Remaining tabs: ${remainingConnections}]`,
        );

        // Nếu người dùng đã đóng tab cuối cùng (không còn socket nào hoạt động): Chuyển sang Offline
        if (isLastConnection) {
            const lastSeen = new Date();
            await this.userRepository.update(userId, {
                isOnline: false,
                lastSeen,
            });
            await this.broadcastPresence(userId, false, lastSeen);
        }
    }

    /**
     * Helper: Fanout trạng thái Online/Offline đến toàn bộ bạn bè của user
     */
    private async broadcastPresence(
        userId: string,
        isOnline: boolean,
        lastSeen?: Date,
    ): Promise<void> {
        try {
            const friendships = await this.friendshipRepository.find({
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

            const payload = {
                userId,
                isOnline,
                lastSeen: lastSeen || new Date(),
            };

            for (const f of friendships) {
                const friendId = f.requester.id === userId ? f.addressee.id : f.requester.id;
                if (this.server) {
                    this.server.to(`user_${friendId}`).emit('userPresence', payload);
                }
            }
        } catch (error) {
            this.logger.error(
                `[Presence] Lỗi khi broadcast presence cho user ${userId}: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Tham gia vào Room của một cuộc hội thoại cụ thể (conv_${conversationId})
     * Yêu cầu người gọi phải là thành viên hợp lệ (BR-08)
     */
    @SubscribeMessage('joinConversation')
    async handleJoinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: JoinConversationDto,
    ) {
        const user = client.data?.user;
        if (!user?.id) {
            throw new WsException('Unauthorized: Missing authenticated session');
        }

        const conversationId = data?.conversationId;
        if (!conversationId) {
            throw new BadRequestException('conversationId không được để trống');
        }

        // Kiểm tra quyền thành viên cuộc hội thoại (BR-08)
        await this.conversationsService.validateMembership(conversationId, user.id);

        const roomId = `conv_${conversationId}`;
        await client.join(roomId);

        this.logger.log(
            `[Room] Socket ${client.id} (User: ${user.username}) đã gia nhập ${roomId}`,
        );

        return {
            status: 'success',
            conversationId,
        };
    }

    /**
     * Rời khỏi Room của cuộc hội thoại
     */
    @SubscribeMessage('leaveConversation')
    async handleLeaveConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: JoinConversationDto,
    ) {
        const conversationId = data?.conversationId;
        if (conversationId) {
            const roomId = `conv_${conversationId}`;
            await client.leave(roomId);
            this.logger.log(`[Room] Socket ${client.id} đã rời ${roomId}`);
        }

        return {
            status: 'success',
            conversationId,
        };
    }

    /**
     * Gửi tin nhắn tức thời vào cuộc hội thoại (FR-15, BR-08, BR-09, BR-10)
     * Lưu tin nhắn vào DB trước (SSOT), sau đó mới phát event newMessage cho toàn bộ room
     */
    @SubscribeMessage('sendMessage')
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() dto: SendMessageDto,
    ) {
        const user = client.data?.user;
        if (!user?.id) {
            throw new WsException('Unauthorized: Missing authenticated session');
        }

        // 1. Lưu tin nhắn vào DB qua ConversationsService (xác thực thành viên, validate độ dài, cập nhật unreadCount)
        const message = await this.conversationsService.createMessage(user.id, dto);

        // 2. Chuẩn hóa payload sự kiện newMessage phát sóng theo chuẩn SPEC Section 6.2
        const payload = {
            id: message.id,
            conversationId: dto.conversationId,
            content: message.content,
            type: message.type,
            fileUrl: message.fileUrl,
            fileSize: message.fileSize ?? null,
            replyToId: message.replyToId,
            replyTo: (message as any).replyTo || null,
            reactions: (message as any).reactions || [],
            isRecalled: message.isRecalled,
            isEdited: message.isEdited,
            editedAt: message.editedAt,
            isPinned: message.isPinned,
            createdAt: message.createdAt,
            sender: {
                id: message.sender.id,
                username: message.sender.username,
                displayName: message.sender.displayName,
                avatarUrl: message.sender.avatarUrl,
            },
        };

        // 3. Phát sóng tới TẤT CẢ các thành viên trong room conv_${conversationId}
        // Lưu ý: Dùng this.server.to() để CẢ người gửi (đồng bộ các tab khác của người gửi)
        // và các thành viên khác trong phòng đều nhận được tin nhắn!
        const roomId = `conv_${dto.conversationId}`;
        this.server.to(roomId).emit('newMessage', payload);

        // 4. Trả về ACK cho socket gửi tin
        return {
            status: 'success',
            data: payload,
        };
    }

    /**
     * Sự kiện gõ phím tức thời (Typing indicator)
     * Broadcast cho các thành viên KHÁC trong phòng (client.to), không lưu DB
     */
    @SubscribeMessage('typing')
    async handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() dto: TypingDto,
    ) {
        const user = client.data?.user;
        if (!user?.id) {
            throw new WsException('Unauthorized: Missing authenticated session');
        }

        const roomId = `conv_${dto.conversationId}`;
        // Gửi cho tất cả client trong room TRỪ chính client người gửi (client.to)
        // Kèm avatarUrl và displayName để phía UI hiển thị avatar nhỏ và hiệu ứng typing 3 chấm
        client.to(roomId).emit('userTyping', {
            conversationId: dto.conversationId,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isTyping: dto.isTyping,
        });

        return {
            status: 'success',
        };
    }

    /**
     * Đánh dấu đã đọc toàn bộ tin nhắn trong cuộc hội thoại (FR-16, BR-10)
     * Cập nhật DB: unreadCount = 0, lastReadMessageId = conversation.lastMessageId
     * Broadcast event messageRead kèm avatarUrl cho các thành viên trong room để hiển thị icon đã đọc
     */
    @SubscribeMessage('markAsRead')
    async handleMarkAsRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() dto: MarkAsReadDto,
    ) {
        const user = client.data?.user;
        if (!user?.id) {
            throw new WsException('Unauthorized: Missing authenticated session');
        }

        const result = await this.conversationsService.markAsRead(user.id, dto.conversationId);

        const roomId = `conv_${dto.conversationId}`;
        this.server.to(roomId).emit('messageRead', {
            conversationId: dto.conversationId,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            lastReadMessageId: result.lastReadMessageId,
        });

        return {
            status: 'success',
            data: result,
        };
    }

    /**
     * Thu hồi tin nhắn qua WebSocket (Milestone 5, BR-M5-01 -> BR-M5-03)
     */
    @SubscribeMessage('recallMessage')
    async handleRecallMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() dto: RecallMessageDto,
    ) {
        const user = client.data?.user;
        if (!user?.id) {
            throw new WsException('Unauthorized: Missing authenticated session');
        }

        const recalledMessage = await this.conversationsService.recallMessage(
            user.id,
            dto.conversationId,
            dto.messageId,
        );

        return {
            status: 'success',
            data: {
                messageId: recalledMessage.id,
                conversationId: dto.conversationId,
                isRecalled: recalledMessage.isRecalled,
                content: recalledMessage.content,
            },
        };
    }

    /**
     * Chỉnh sửa tin nhắn văn bản qua WebSocket (Milestone 5, BR-M5-04 -> BR-M5-07)
     */
    @SubscribeMessage('editMessage')
    async handleEditMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() dto: EditMessageDto,
    ) {
        const user = client.data?.user;
        if (!user?.id) {
            throw new WsException('Unauthorized: Missing authenticated session');
        }

        if (!dto.conversationId || !dto.messageId) {
            throw new BadRequestException('conversationId và messageId không được để trống');
        }

        const editedMessage = await this.conversationsService.editMessage(
            user.id,
            dto.conversationId,
            dto.messageId,
            dto.content,
        );

        return {
            status: 'success',
            data: {
                messageId: editedMessage.id,
                conversationId: dto.conversationId,
                content: editedMessage.content,
                isEdited: editedMessage.isEdited,
                editedAt: editedMessage.editedAt,
            },
        };
    }

    /**
     * Thả hoặc hủy cảm xúc vào tin nhắn qua WebSocket (Milestone 5, BR-M5-07, BR-M5-08)
     */
    @SubscribeMessage('reactMessage')
    async handleReactMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() dto: ReactMessageDto,
    ) {
        const user = client.data?.user;
        if (!user?.id) {
            throw new WsException('Unauthorized: Missing authenticated session');
        }

        if (!dto.conversationId || !dto.messageId || !dto.emoji) {
            throw new BadRequestException('conversationId, messageId và emoji không được để trống');
        }

        const result = await this.conversationsService.reactMessage(
            user.id,
            dto.conversationId,
            dto.messageId,
            dto.emoji,
        );

        return {
            status: 'success',
            data: result,
        };
    }

    // =========================================================================
    // REALTIME NOTIFICATION EVENT LISTENERS (In-App Event Bus Mediator)
    // =========================================================================

    /**
     * Thông báo lời mời kết bạn mới tới người nhận (user_${addresseeId})
     */
    @OnEvent('friend.request_sent')
    handleFriendRequestSent(event: FriendRequestSentEvent) {
        if (!this.server) return;
        this.server.to(`user_${event.addresseeId}`).emit('friendRequestReceived', {
            requestId: event.requestId,
            requester: event.requester,
            createdAt: event.createdAt,
        });
        this.logger.log(`[Notification] Lời mời kết bạn từ ${event.requester.username} gửi tới user_${event.addresseeId}`);
    }

    /**
     * Thông báo đối phương đã chấp nhận kết bạn tới người gửi ban đầu (user_${requesterId})
     */
    @OnEvent('friend.request_accepted')
    handleFriendRequestAccepted(event: FriendRequestAcceptedEvent) {
        if (!this.server) return;
        this.server.to(`user_${event.requesterId}`).emit('friendRequestAccepted', {
            friendshipId: event.friendshipId,
            friend: event.friend,
            createdAt: event.createdAt,
        });
        this.logger.log(`[Notification] Đối phương chấp nhận kết bạn phát tới user_${event.requesterId}`);
    }

    /**
     * Thông báo lời mời kết bạn bị từ chối tới người gửi ban đầu
     */
    @OnEvent('friend.request_rejected')
    handleFriendRequestRejected(event: FriendRequestRejectedEvent) {
        if (!this.server) return;
        this.server.to(`user_${event.requesterId}`).emit('friendRequestRejected', {
            requestId: event.requestId,
        });
    }

    /**
     * Thông báo người gửi đã thu hồi lời mời kết bạn tới người nhận
     */
    @OnEvent('friend.request_cancelled')
    handleFriendRequestCancelled(event: FriendRequestCancelledEvent) {
        if (!this.server) return;
        this.server.to(`user_${event.addresseeId}`).emit('friendRequestCancelled', {
            requestId: event.requestId,
        });
    }

    /**
     * Thông báo hủy kết bạn cho cả 2 phía
     */
    @OnEvent('friend.removed')
    handleFriendRemoved(event: FriendRemovedEvent) {
        if (!this.server) return;
        this.server.to(`user_${event.friendId}`).emit('friendRemoved', { friendId: event.userId });
        this.server.to(`user_${event.userId}`).emit('friendRemoved', { friendId: event.friendId });
    }

    /**
     * Thông báo có cuộc trò chuyện mới (Direct hoặc Group) cho tất cả các thành viên tham gia
     */
    @OnEvent('conversation.created')
    handleConversationCreated(event: ConversationCreatedEvent) {
        if (!this.server) return;
        for (const memberId of event.memberIds) {
            this.server.to(`user_${memberId}`).emit('conversationCreated', event.conversation);
        }
        this.logger.log(`[Notification] Cuộc trò chuyện mới ${event.conversationId} phát tới ${event.memberIds.length} thành viên`);
    }

    /**
     * Cập nhật Inbox toàn cục (lastMessage & unreadCount) tới các thành viên ngoài phòng chat
     */
    @OnEvent('inbox.updated')
    handleInboxUpdated(event: InboxUpdatedEvent) {
        if (!this.server) return;
        for (const memberId of event.memberIds) {
            this.server.to(`user_${memberId}`).emit('conversationUpdated', {
                conversationId: event.conversationId,
                lastMessage: event.lastMessage,
                senderId: event.senderId,
            });
        }
    }

    /**
     * Thông báo thay đổi thành viên trong nhóm (Thêm, Xóa, Rời nhóm)
     */
    @OnEvent('group.member_event')
    handleGroupMemberEvent(event: GroupMemberEvent) {
        if (!this.server) return;
        // Bắn vào phòng chat cho những người đang mở cửa sổ nhóm
        this.server.to(`conv_${event.conversationId}`).emit('groupMemberUpdated', {
            conversationId: event.conversationId,
            action: event.action,
            actor: event.actor,
            targetUserIds: event.targetUserIds,
        });

        // Bắn vào kênh cá nhân của các user bị tác động (đặc biệt khi bị KICK hoặc được ADD)
        for (const targetId of event.targetUserIds) {
            this.server.to(`user_${targetId}`).emit('groupMembershipChanged', {
                conversationId: event.conversationId,
                action: event.action,
            });
        }
    }

    /**
     * Thông báo ghim / bỏ ghim tin nhắn trong phòng hội thoại
     */
    @OnEvent('message.pinned')
    handleMessagePinned(event: MessagePinnedEvent) {
        if (!this.server) return;
        const roomId = `conv_${event.conversationId}`;
        if (event.isPinned) {
            this.server.to(roomId).emit('messagePinned', {
                conversationId: event.conversationId,
                messageId: event.messageId,
                message: event.message,
                pinnedBy: event.pinnedBy,
            });
        } else {
            this.server.to(roomId).emit('messageUnpinned', {
                conversationId: event.conversationId,
                messageId: event.messageId,
            });
        }
    }

    /**
     * Broadcast sự kiện thu hồi tin nhắn tới phòng chat (conv_${conversationId})
     */
    @OnEvent('message.recalled')
    handleMessageRecalled(event: MessageRecalledEvent) {
        if (!this.server) return;
        const roomId = `conv_${event.conversationId}`;
        this.server.to(roomId).emit('messageRecalled', {
            conversationId: event.conversationId,
            messageId: event.messageId,
            recalledAt: event.recalledAt,
            senderId: event.senderId,
        });

        // Nếu là tin nhắn cuối cùng, cập nhật preview cho inbox của các thành viên
        if (event.isLastMessage && event.memberIds) {
            for (const memberId of event.memberIds) {
                this.server.to(`user_${memberId}`).emit('conversationUpdated', {
                    conversationId: event.conversationId,
                    lastMessage: {
                        id: event.messageId,
                        content: '[Tin nhắn đã bị thu hồi]',
                        isRecalled: true,
                    },
                });
            }
        }
    }

    /**
     * Broadcast sự kiện chỉnh sửa tin nhắn tới phòng chat (conv_${conversationId})
     */
    @OnEvent('message.edited')
    handleMessageEdited(event: MessageEditedEvent) {
        if (!this.server) return;
        const roomId = `conv_${event.conversationId}`;
        this.server.to(roomId).emit('messageEdited', {
            conversationId: event.conversationId,
            messageId: event.messageId,
            content: event.content,
            isEdited: true,
            editedAt: event.editedAt,
            senderId: event.senderId,
        });

        // Nếu là tin nhắn cuối cùng, cập nhật preview cho inbox của các thành viên
        if (event.isLastMessage && event.memberIds) {
            for (const memberId of event.memberIds) {
                this.server.to(`user_${memberId}`).emit('conversationUpdated', {
                    conversationId: event.conversationId,
                    lastMessage: {
                        id: event.messageId,
                        content: event.content,
                        isEdited: true,
                        editedAt: event.editedAt,
                    },
                });
            }
        }
    }

    /**
     * Broadcast tin nhắn mới vào phòng chat khi tin nhắn được tạo từ REST API (như Media Upload)
     */
    @OnEvent('message.created')
    handleMessageCreated(event: MessageCreatedEvent) {
        if (!this.server) return;
        const roomId = `conv_${event.conversationId}`;
        this.server.to(roomId).emit('newMessage', event.message);
    }

    /**
     * Broadcast sự kiện cập nhật cảm xúc tới phòng chat (conv_${conversationId})
     */
    @OnEvent('message.reaction_updated')
    handleMessageReactionUpdated(event: MessageReactionEvent) {
        if (!this.server) return;
        const roomId = `conv_${event.conversationId}`;
        this.server.to(roomId).emit('messageReactionUpdated', {
            conversationId: event.conversationId,
            messageId: event.messageId,
            user: event.user,
            emoji: event.emoji,
            action: event.action,
        });
    }
}




