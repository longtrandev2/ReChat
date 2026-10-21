import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { Friendship } from '../src/modules/friends/entities/friendship.entity.js';
import { Conversation, ConversationType } from '../src/modules/conversations/entities/conversation.entity.js';
import { ConversationMember, ConversationRole } from '../src/modules/conversations/entities/conversation-member.entity.js';
import { Message, MessageType } from '../src/modules/conversations/entities/message.entity.js';
import { MessageReaction } from '../src/modules/conversations/entities/message-reaction.entity.js';
import { MediaService } from '../src/modules/media/media.service.js';

describe('Milestone 5 - Rich Messaging & Real-time Notifications (e2e)', () => {
    let app: INestApplication;
    let wsUrl: string;
    let jwtService: JwtService;

    let userRepo: Repository<User>;
    let friendshipRepo: Repository<Friendship>;
    let conversationRepo: Repository<Conversation>;
    let memberRepo: Repository<ConversationMember>;
    let messageRepo: Repository<Message>;
    let reactionRepo: Repository<MessageReaction>;

    let userA: User;
    let userB: User;
    let tokenA: string;
    let tokenB: string;
    let testConversation: Conversation;

    const waitForEvent = <T = any>(socket: Socket, event: string, timeoutMs = 8000): Promise<T> => {
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

    const createAuthenticatedSocket = async (token: string): Promise<Socket> => {
        const socket = io(wsUrl, {
            auth: { token },
            transports: ['websocket'],
            forceNew: true,
        });
        await waitForEvent(socket, 'connect');
        await new Promise((r) => setTimeout(r, 80));
        return socket;
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api/v1');
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
        reactionRepo = app.get(getRepositoryToken(MessageReaction));

        // 1. Dọn dẹp dữ liệu cũ (nếu có)
        const oldUsers = await userRepo.find({
            where: [{ username: 'm5_e2e_user_a' }, { username: 'm5_e2e_user_b' }],
        });
        for (const u of oldUsers) {
            await reactionRepo.delete({ user: { id: u.id } });
            await messageRepo.delete({ sender: { id: u.id } });
            await memberRepo.delete({ user: { id: u.id } });
            await friendshipRepo.delete({ requester: { id: u.id } });
            await friendshipRepo.delete({ addressee: { id: u.id } });
            await userRepo.delete({ id: u.id });
        }

        // 2. Tạo 2 người dùng thử nghiệm
        userA = await userRepo.save(
            userRepo.create({
                username: 'm5_e2e_user_a',
                password: 'hashed_password',
                displayName: 'Nguyễn Văn A (M5)',
                avatarUrl: 'https://avatar.url/user_a.png',
                isOnline: false,
            }),
        );

        userB = await userRepo.save(
            userRepo.create({
                username: 'm5_e2e_user_b',
                password: 'hashed_password',
                displayName: 'Trần Thị B (M5)',
                avatarUrl: 'https://avatar.url/user_b.png',
                isOnline: false,
            }),
        );

        // 3. Tạo cuộc hội thoại DIRECT
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

        tokenA = await jwtService.signAsync({ sub: userA.id, username: userA.username });
        tokenB = await jwtService.signAsync({ sub: userB.id, username: userB.username });
    });

    afterAll(async () => {
        try {
            if (testConversation?.id) {
                await reactionRepo.delete({});
                await messageRepo.delete({ conversation: { id: testConversation.id } });
                await memberRepo.delete({ conversation: { id: testConversation.id } });
                await conversationRepo.delete({ id: testConversation.id });
            }
            if (userA?.id && userB?.id) {
                await friendshipRepo.delete({ requester: { id: userA.id } });
                await friendshipRepo.delete({ addressee: { id: userA.id } });
                await userRepo.delete({ id: userA.id });
                await userRepo.delete({ id: userB.id });
            }
            await app.close();
        } catch {
            // Dọn dẹp graceful
        }
    });

    it('1. Friend Notification Bridge: REST friend request triggers realtime friendRequestReceived to socket', async () => {
        const socketB = await createAuthenticatedSocket(tokenB);

        const friendRequestPromise = waitForEvent(socketB, 'friendRequestReceived');

        // User A gửi lời mời kết bạn tới User B qua REST
        const res = await request(app.getHttpServer())
            .post(`/api/v1/friends/request/${userB.id}`)
            .set('Authorization', `Bearer ${tokenA}`)
            .expect(201);

        expect(res.body.data || res.body).toBeDefined();

        const receivedEvent = await friendRequestPromise;
        expect(receivedEvent).toBeDefined();
        expect(receivedEvent.requester.id).toBe(userA.id);
        expect(receivedEvent.requester.username).toBe(userA.username);

        socketB.close();
    }, 15000);

    it('2. Global Inbox Sync: sending message triggers conversationUpdated in personal room', async () => {
        // User B chỉ kết nối socket (ở personal room user_B), CHƯA vào phòng conv_${id}
        const socketB = await createAuthenticatedSocket(tokenB);

        const inboxUpdatedPromise = waitForEvent(socketB, 'conversationUpdated');

        // User A kết nối và vào phòng chat để gửi tin nhắn
        const socketA = await createAuthenticatedSocket(tokenA);

        await new Promise((resolve) => socketA.emit('joinConversation', { conversationId: testConversation.id }, resolve));

        socketA.emit('sendMessage', {
            conversationId: testConversation.id,
            content: 'Xin chào B, mình đang test Inbox sync!',
            type: MessageType.TEXT,
        });

        const inboxPayload = await inboxUpdatedPromise;
        expect(inboxPayload).toBeDefined();
        expect(inboxPayload.conversationId).toBe(testConversation.id);
        expect(inboxPayload.lastMessage.content).toBe('Xin chào B, mình đang test Inbox sync!');

        socketA.close();
        socketB.close();
    }, 15000);

    it('3. Edit Message: editing message within 15 mins triggers messageEdited event in room', async () => {
        const socketA = await createAuthenticatedSocket(tokenA);
        const socketB = await createAuthenticatedSocket(tokenB);

        await new Promise((resolve) => socketA.emit('joinConversation', { conversationId: testConversation.id }, resolve));
        await new Promise((resolve) => socketB.emit('joinConversation', { conversationId: testConversation.id }, resolve));

        // 1. A gửi tin nhắn ban đầu
        const messageCreatedPromise = waitForEvent(socketB, 'newMessage');
        socketA.emit('sendMessage', {
            conversationId: testConversation.id,
            content: 'Nội dung gốc trước khi sửa',
            type: MessageType.TEXT,
        });
        const createdMsg = await messageCreatedPromise;
        expect(createdMsg.content).toBe('Nội dung gốc trước khi sửa');

        // 2. A gửi socket editMessage
        const messageEditedPromise = waitForEvent(socketB, 'messageEdited');
        const editAck = await new Promise<any>((resolve) => {
            socketA.emit('editMessage', {
                messageId: createdMsg.id,
                conversationId: testConversation.id,
                content: 'Nội dung sau khi đã chỉnh sửa',
            }, resolve);
        });
        expect(editAck?.status).toBe('success');

        const editedEvent = await messageEditedPromise;
        expect(editedEvent).toBeDefined();
        expect(editedEvent.messageId).toBe(createdMsg.id);
        expect(editedEvent.content).toBe('Nội dung sau khi đã chỉnh sửa');
        expect(editedEvent.isEdited).toBe(true);

        socketA.close();
        socketB.close();
    }, 15000);

    it('4. Recall Message: recalling message triggers messageRecalled and sanitizes content', async () => {
        const socketA = await createAuthenticatedSocket(tokenA);
        const socketB = await createAuthenticatedSocket(tokenB);

        await new Promise((resolve) => socketA.emit('joinConversation', { conversationId: testConversation.id }, resolve));
        await new Promise((resolve) => socketB.emit('joinConversation', { conversationId: testConversation.id }, resolve));

        // 1. A gửi tin nhắn cần thu hồi
        const messageCreatedPromise = waitForEvent(socketB, 'newMessage');
        socketA.emit('sendMessage', {
            conversationId: testConversation.id,
            content: 'Tin nhắn này sẽ bị thu hồi ngay lập tức',
            type: MessageType.TEXT,
        });
        const createdMsg = await messageCreatedPromise;

        // 2. A gửi socket recallMessage
        const messageRecalledPromise = waitForEvent(socketB, 'messageRecalled');
        const recallAck = await new Promise<any>((resolve) => {
            socketA.emit('recallMessage', {
                messageId: createdMsg.id,
                conversationId: testConversation.id,
            }, resolve);
        });
        expect(recallAck?.status).toBe('success');

        const recalledEvent = await messageRecalledPromise;
        expect(recalledEvent).toBeDefined();
        expect(recalledEvent.messageId).toBe(createdMsg.id);

        // 3. Kiểm tra DB xem nội dung đã được sanitize chưa
        const dbMsg = await messageRepo.findOne({ where: { id: createdMsg.id } });
        expect(dbMsg?.isRecalled).toBe(true);
        expect(dbMsg?.content).toBe('[Tin nhắn đã bị thu hồi]');

        socketA.close();
        socketB.close();
    }, 15000);

    it('5. Emoji Reactions: toggling emoji triggers messageReactionUpdated with ADDED and REMOVED', async () => {
        const socketA = await createAuthenticatedSocket(tokenA);
        const socketB = await createAuthenticatedSocket(tokenB);

        await new Promise((resolve) => socketA.emit('joinConversation', { conversationId: testConversation.id }, resolve));
        await new Promise((resolve) => socketB.emit('joinConversation', { conversationId: testConversation.id }, resolve));

        // 1. A gửi tin nhắn
        const newMsgPromise = waitForEvent(socketB, 'newMessage');
        socketA.emit('sendMessage', {
            conversationId: testConversation.id,
            content: 'Hãy thả tim cho tin nhắn này nhé',
            type: MessageType.TEXT,
        });
        const msg = await newMsgPromise;

        // 2. B thả reaction '❤️' (ADDED)
        const reactAddedPromise = waitForEvent(socketA, 'messageReactionUpdated');
        const reactAddAck = await new Promise<any>((resolve) => {
            socketB.emit('reactMessage', {
                messageId: msg.id,
                conversationId: testConversation.id,
                emoji: '❤️',
            }, resolve);
        });
        expect(reactAddAck?.status).toBe('success');

        const addEvent = await reactAddedPromise;
        expect(addEvent).toBeDefined();
        expect(addEvent.action).toBe('ADDED');
        expect(addEvent.emoji).toBe('❤️');
        expect(addEvent.user.id).toBe(userB.id);

        // 3. B bấm lại '❤️' để gỡ reaction (REMOVED)
        const reactRemovedPromise = waitForEvent(socketA, 'messageReactionUpdated');
        const reactRemoveAck = await new Promise<any>((resolve) => {
            socketB.emit('reactMessage', {
                messageId: msg.id,
                conversationId: testConversation.id,
                emoji: '❤️',
            }, resolve);
        });
        expect(reactRemoveAck?.status).toBe('success');

        const removeEvent = await reactRemovedPromise;
        expect(removeEvent).toBeDefined();
        expect(removeEvent.action).toBe('REMOVED');
        expect(removeEvent.emoji).toBe('❤️');

        socketA.close();
        socketB.close();
    }, 15000);

    it('6. Media Upload & Auto-publish: REST upload auto-publishes newMessage to room', async () => {
        const socketB = await createAuthenticatedSocket(tokenB);
        await new Promise((resolve) => socketB.emit('joinConversation', { conversationId: testConversation.id }, resolve));

        const mediaService = app.get(MediaService);
        const uploadSpy = vi.spyOn(mediaService, 'uploadToCloudinary').mockResolvedValue({
            public_id: 'rechat/images/mock_e2e_photo',
            secure_url: 'https://res.cloudinary.com/test/image/upload/mock_e2e_photo.png',
        });

        const mediaMsgPromise = waitForEvent(socketB, 'newMessage');

        const dummyImageBuffer = Buffer.from('fake-png-content');

        const uploadRes = await request(app.getHttpServer())
            .post('/api/v1/media/upload')
            .set('Authorization', `Bearer ${tokenA}`)
            .field('conversationId', testConversation.id)
            .attach('file', dummyImageBuffer, 'sample.png')
            .expect(200);

        expect(uploadRes.body.data || uploadRes.body).toBeDefined();

        const receivedMediaMsg = await mediaMsgPromise;
        expect(receivedMediaMsg).toBeDefined();
        expect(receivedMediaMsg.type).toBe(MessageType.IMAGE);
        expect(receivedMediaMsg.fileUrl).toContain('mock_e2e_photo.png');

        uploadSpy.mockRestore();
        socketB.close();
    }, 15000);
});
