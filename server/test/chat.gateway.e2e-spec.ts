import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { Friendship, FriendshipStatus } from '../src/modules/friends/entities/friendship.entity.js';
import { Conversation, ConversationType } from '../src/modules/conversations/entities/conversation.entity.js';
import { ConversationMember, ConversationRole } from '../src/modules/conversations/entities/conversation-member.entity.js';
import { Message } from '../src/modules/conversations/entities/message.entity.js';

describe('ChatGateway (e2e) - Layer 5 Real-time Verification', () => {
    let app: INestApplication;
    let wsUrl: string;
    let jwtService: JwtService;

    let userRepo: Repository<User>;
    let friendshipRepo: Repository<Friendship>;
    let conversationRepo: Repository<Conversation>;
    let memberRepo: Repository<ConversationMember>;
    let messageRepo: Repository<Message>;

    let userA: User;
    let userB: User;
    let tokenA: string;
    let tokenB: string;
    let testConversation: Conversation;

    const waitForEvent = <T = any>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
            }, timeoutMs);

            socket.once(event, (data: T) => {
                clearTimeout(timer);
                resolve(data);
            });
        });
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

        await app.init();
        await app.listen(0);

        const address = app.getHttpServer().address();
        const port = typeof address === 'string' ? address : address?.port;
        wsUrl = `http://localhost:${port}`;

        jwtService = app.get(JwtService);
        userRepo = app.get(getRepositoryToken(User));
        friendshipRepo = app.get(getRepositoryToken(Friendship));
        conversationRepo = app.get(getRepositoryToken(Conversation));
        memberRepo = app.get(getRepositoryToken(ConversationMember));
        messageRepo = app.get(getRepositoryToken(Message));

        // 1. Dọn dẹp dữ liệu cũ (nếu có)
        await userRepo.delete({ username: 'e2e_ws_user_a' });
        await userRepo.delete({ username: 'e2e_ws_user_b' });

        // 2. Tạo 2 người dùng thử nghiệm A và B
        userA = await userRepo.save(
            userRepo.create({
                username: 'e2e_ws_user_a',
                password: 'hashed_password',
                displayName: 'Nguyễn Văn A',
                avatarUrl: 'https://avatar.url/user_a.png',
                isOnline: false,
            }),
        );

        userB = await userRepo.save(
            userRepo.create({
                username: 'e2e_ws_user_b',
                password: 'hashed_password',
                displayName: 'Trần Thị B',
                avatarUrl: 'https://avatar.url/user_b.png',
                isOnline: false,
            }),
        );

        // 3. Thiết lập quan hệ bạn bè 2 chiều đã chấp nhận (ACCEPTED)
        await friendshipRepo.save(
            friendshipRepo.create({
                requester: userA,
                addressee: userB,
                status: FriendshipStatus.ACCEPTED,
            }),
        );

        // 4. Tạo cuộc hội thoại DIRECT giữa A và B
        testConversation = await conversationRepo.save(
            conversationRepo.create({
                type: ConversationType.DIRECT,
            }),
        );

        await memberRepo.save([
            memberRepo.create({
                conversation: testConversation,
                user: userA,
                role: ConversationRole.MEMBER,
            }),
            memberRepo.create({
                conversation: testConversation,
                user: userB,
                role: ConversationRole.MEMBER,
            }),
        ]);

        // 5. Sinh JWT Token hợp lệ cho User A và User B
        tokenA = await jwtService.signAsync({ sub: userA.id, username: userA.username });
        tokenB = await jwtService.signAsync({ sub: userB.id, username: userB.username });
    });

    afterAll(async () => {
        try {
            if (testConversation?.id) {
                await messageRepo.delete({ conversation: { id: testConversation.id } });
                await memberRepo.delete({ conversation: { id: testConversation.id } });
                await conversationRepo.delete({ id: testConversation.id });
            }
            if (userA?.id && userB?.id) {
                await friendshipRepo.delete({ requester: { id: userA.id } });
                await userRepo.delete({ id: userA.id });
                await userRepo.delete({ id: userB.id });
            }
            await app.close();
        } catch {
            // Dọn dẹp graceful
        }
    });

    it('1. Handshake Auth: should reject connection without JWT token', async () => {
        const socket = io(wsUrl, {
            autoConnect: true,
            transports: ['websocket'],
        });

        const exceptionPromise = waitForEvent(socket, 'exception');
        const disconnectPromise = waitForEvent(socket, 'disconnect');

        const [exception] = await Promise.all([exceptionPromise, disconnectPromise]);

        expect(exception).toEqual(
            expect.objectContaining({
                status: 'error',
                message: 'Unauthorized: Missing authentication token',
            }),
        );

        socket.close();
        await new Promise((r) => setTimeout(r, 50));
    });

    it('2. Handshake Auth: should connect successfully with valid JWT token', async () => {
        const socketA = io(wsUrl, {
            auth: { token: tokenA },
            transports: ['websocket'],
        });

        await waitForEvent(socketA, 'connect');
        expect(socketA.connected).toBe(true);

        const disconnectPromise = waitForEvent(socketA, 'disconnect');
        socketA.close();
        await disconnectPromise;
        await new Promise((r) => setTimeout(r, 50));
    });

    it('3. Presence & Multi-device: should broadcast online/offline presence between friends', async () => {
        // User B kết nối trước
        const socketB = io(wsUrl, {
            auth: { token: tokenB },
            transports: ['websocket'],
        });
        await waitForEvent(socketB, 'connect');

        // B chuẩn bị lắng nghe sự kiện userPresence của A (A goes online)
        const aGoesOnlinePromise = waitForEvent(socketB, 'userPresence');

        // User A kết nối (Online)
        const socketA = io(wsUrl, {
            auth: { token: tokenA },
            transports: ['websocket'],
        });
        await waitForEvent(socketA, 'connect');

        const onlinePresence = await aGoesOnlinePromise;
        expect(onlinePresence).toEqual(
            expect.objectContaining({
                userId: userA.id,
                isOnline: true,
            }),
        );

        // B chuẩn bị lắng nghe A ngắt kết nối (Offline)
        const aGoesOfflinePromise = waitForEvent(socketB, 'userPresence');

        // A đóng socket
        const aDisconnectPromise = waitForEvent(socketA, 'disconnect');
        socketA.disconnect();
        await aDisconnectPromise;

        const offlinePresence = await aGoesOfflinePromise;
        expect(offlinePresence).toEqual(
            expect.objectContaining({
                userId: userA.id,
                isOnline: false,
            }),
        );

        const bDisconnectPromise = waitForEvent(socketB, 'disconnect');
        socketB.close();
        await bDisconnectPromise;
        await new Promise((r) => setTimeout(r, 50));
    });

    it('4. Room Management: should allow members to join conversation room', async () => {
        const socketA = io(wsUrl, {
            auth: { token: tokenA },
            transports: ['websocket'],
        });
        await waitForEvent(socketA, 'connect');

        // Gửi sự kiện joinConversation với callback ACK
        const ackResponse = await new Promise((resolve) => {
            socketA.emit('joinConversation', { conversationId: testConversation.id }, resolve);
        });

        expect(ackResponse).toEqual({
            status: 'success',
            conversationId: testConversation.id,
        });

        const disconnectPromise = waitForEvent(socketA, 'disconnect');
        socketA.close();
        await disconnectPromise;
        await new Promise((r) => setTimeout(r, 50));
    });

    it('5. Real-time Messaging & Typing & Read Receipts: complete end-to-end conversation flow', async () => {
        // Cả User A và User B cùng kết nối
        const socketA = io(wsUrl, {
            auth: { token: tokenA },
            transports: ['websocket'],
        });
        const socketB = io(wsUrl, {
            auth: { token: tokenB },
            transports: ['websocket'],
        });

        await Promise.all([waitForEvent(socketA, 'connect'), waitForEvent(socketB, 'connect')]);

        // Cả 2 cùng gia nhập room cuộc hội thoại
        await new Promise((resolve) => socketA.emit('joinConversation', { conversationId: testConversation.id }, resolve));
        await new Promise((resolve) => socketB.emit('joinConversation', { conversationId: testConversation.id }, resolve));

        // --- BƯỚC 1: A gõ phím -> B nhận userTyping kèm avatar & displayName ---
        const typingPromise = waitForEvent(socketB, 'userTyping');
        socketA.emit('typing', { conversationId: testConversation.id, isTyping: true });

        const typingData = await typingPromise;
        expect(typingData).toEqual(
            expect.objectContaining({
                conversationId: testConversation.id,
                userId: userA.id,
                username: userA.username,
                displayName: userA.displayName,
                avatarUrl: userA.avatarUrl,
                isTyping: true,
            }),
        );

        // --- BƯỚC 2: A gửi tin nhắn -> B nhận newMessage thời gian thực ---
        const newMessagePromise = waitForEvent(socketB, 'newMessage');

        const sendAck = await new Promise<any>((resolve) => {
            socketA.emit(
                'sendMessage',
                {
                    conversationId: testConversation.id,
                    content: 'Chào B, đây là tin nhắn thời gian thực từ E2E!',
                },
                resolve,
            );
        });

        expect(sendAck.status).toBe('success');
        expect(sendAck.data.content).toBe('Chào B, đây là tin nhắn thời gian thực từ E2E!');

        const receivedMessage = await newMessagePromise;
        expect(receivedMessage).toEqual(
            expect.objectContaining({
                conversationId: testConversation.id,
                content: 'Chào B, đây là tin nhắn thời gian thực từ E2E!',
                sender: expect.objectContaining({
                    id: userA.id,
                    username: userA.username,
                    displayName: userA.displayName,
                    avatarUrl: userA.avatarUrl,
                }),
            }),
        );

        // --- BƯỚC 3: B đánh dấu đã đọc (markAsRead) -> A nhận messageRead kèm avatar của B ---
        const messageReadPromise = waitForEvent(socketA, 'messageRead');

        const readAck = await new Promise<any>((resolve) => {
            socketB.emit('markAsRead', { conversationId: testConversation.id }, resolve);
        });

        expect(readAck.status).toBe('success');

        const readData = await messageReadPromise;
        expect(readData).toEqual(
            expect.objectContaining({
                conversationId: testConversation.id,
                userId: userB.id,
                username: userB.username,
                displayName: userB.displayName,
                avatarUrl: userB.avatarUrl,
                lastReadMessageId: receivedMessage.id,
            }),
        );

        socketA.close();
        socketB.close();
    });
});
