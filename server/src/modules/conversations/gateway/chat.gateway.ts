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
import { SendMessageDto, JoinConversationDto, TypingDto, MarkAsReadDto } from '../dto/index.js';
import { User } from '../../users/entities/user.entity.js';
import { Friendship, FriendshipStatus } from '../../friends/entities/friendship.entity.js';

@WebSocketGateway({
    cors: {
        origin: '*',
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
            replyToId: message.replyToId,
            isRecalled: message.isRecalled,
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
}



