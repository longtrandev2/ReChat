import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { io, Socket } from 'socket.io-client';
import { API, closeE2eApp, createE2eApp, createVerifiedUser, E2eContext, login } from './helpers/e2e-app.helper.js';
import type { User } from '../src/modules/users/entities/user.entity.js';
import { Message, MessageType } from '../src/modules/conversations/entities/message.entity.js';
import { Conversation } from '../src/modules/conversations/entities/conversation.entity.js';
import { Friendship, FriendshipStatus } from '../src/modules/friends/entities/friendship.entity.js';
import { ConversationsService } from '../src/modules/conversations/conversations.service.js';

/**
 * Flow 5 - Business rules cưỡng chế phía server (BR-28, BR-36, BR-38, BR-41, BR-42, BR-M5-05).
 */
describe('Business rules enforced server-side (e2e)', () => {
    let ctx: E2eContext;
    let messageRepo: Repository<Message>;
    let conversationRepo: Repository<Conversation>;
    let friendshipRepo: Repository<Friendship>;
    let conversations: ConversationsService;
    let alice: User;
    let bob: User;
    const tokens: Record<string, string> = {};
    const sockets: Socket[] = [];
    let conversationId = '';
    const password = 'Business@123';

    const asUser = (name: 'alice' | 'bob') => ({ Authorization: `Bearer ${tokens[name]}`, 'X-Device-Id': `e2e-br-${name}` });

    const connect = (name: 'alice' | 'bob') =>
        new Promise<Socket>((resolve, reject) => {
            const socket = io(ctx.baseUrl, { auth: { token: tokens[name] }, transports: ['websocket'], reconnection: false });
            sockets.push(socket);
            socket.once('connect', () => resolve(socket));
            socket.once('connect_error', reject);
        });

    const once = <T = any>(socket: Socket, event: string, timeoutMs = 5000) =>
        new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
            socket.once(event, (data: T) => {
                clearTimeout(timer);
                resolve(data);
            });
        });

    /** Gửi tin qua WebSocket: trả về ACK nếu thành công, hoặc payload `exception` nếu bị từ chối */
    const send = (socket: Socket, payload: Record<string, unknown>) =>
        Promise.race([
            new Promise<{ ok: true; ack: any }>((resolve) =>
                socket.emit('sendMessage', { conversationId, ...payload }, (ack: any) => resolve({ ok: true, ack })),
            ),
            once<any>(socket, 'exception').then((error) => ({ ok: false as const, error })),
        ]);

    /** Đặt createdAt lùi về quá khứ bằng đồng hồ của DB (UTC) */
    const ageMessage = (id: string, minutes: number) =>
        messageRepo.query('UPDATE messages SET createdAt = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ? MINUTE) WHERE id = ?', [minutes, id]);

    beforeAll(async () => {
        ctx = await createE2eApp();
        messageRepo = ctx.app.get(getRepositoryToken(Message));
        conversationRepo = ctx.app.get(getRepositoryToken(Conversation));
        friendshipRepo = ctx.app.get(getRepositoryToken(Friendship));
        conversations = ctx.app.get(ConversationsService);

        alice = await createVerifiedUser(ctx, 'e2e_br_a', password);
        bob = await createVerifiedUser(ctx, 'e2e_br_b', password);
        await friendshipRepo.save(friendshipRepo.create({ requester: alice, addressee: bob, status: FriendshipStatus.ACCEPTED }));
        tokens.alice = (await login(ctx, alice.username, password, 'e2e-br-alice')).accessToken;
        tokens.bob = (await login(ctx, bob.username, password, 'e2e-br-bob')).accessToken;

        const res = await ctx.http().post(`${API}/conversations/direct`).set(asUser('alice')).send({ targetUserId: bob.id });
        conversationId = res.body.data.id;
    });

    afterAll(async () => {
        sockets.forEach((s) => s.disconnect());
        if (conversationId) {
            await messageRepo.delete({ conversation: { id: conversationId } }).catch(() => undefined);
            await conversationRepo.delete({ id: conversationId }).catch(() => undefined);
        }
        if (alice?.id && bob?.id) {
            await friendshipRepo.delete({ requester: { id: alice.id } }).catch(() => undefined);
            await friendshipRepo.delete({ requester: { id: bob.id } }).catch(() => undefined);
        }
        await closeE2eApp(ctx, [alice?.id, bob?.id]);
    });

    it('BR-36: a client cannot forge a SYSTEM message', async () => {
        const socket = await connect('alice');

        const result = await send(socket, { content: 'Thông báo hệ thống giả', type: 'SYSTEM' });
        expect(result.ok).toBe(false);

        const forged = await messageRepo.count({ where: { conversation: { id: conversationId }, type: MessageType.SYSTEM, content: 'Thông báo hệ thống giả' } });
        expect(forged).toBe(0);

        const ok = await send(socket, { content: 'Tin nhắn hợp lệ' });
        expect(ok.ok).toBe(true);
    });

    it('BR-M5-05: a message can be edited within 15 minutes only (also after 1 hour)', async () => {
        const edit = (id: string) =>
            ctx.http().patch(`${API}/conversations/${conversationId}/messages/${id}/edit`).set(asUser('alice')).send({ content: 'Đã sửa' });

        const fresh = await conversations.createMessage(alice.id, { conversationId, content: 'Mới gửi', type: MessageType.TEXT });
        await edit(fresh.id).expect(200);

        const twentyMinutes = await conversations.createMessage(alice.id, { conversationId, content: '20 phút trước', type: MessageType.TEXT });
        await ageMessage(twentyMinutes.id, 20);
        await edit(twentyMinutes.id).expect(400);

        // Regression: bản cũ dùng `% 1 giờ` nên tin gửi 65 phút trước vẫn sửa được
        const overAnHour = await conversations.createMessage(alice.id, { conversationId, content: '65 phút trước', type: MessageType.TEXT });
        await ageMessage(overAnHour.id, 65);
        await edit(overAnHour.id).expect(400);
    });

    it('BR-41 / BR-42: pin is per user and clearing history only affects the caller', async () => {
        const pin = await ctx.http().patch(`${API}/conversations/${conversationId}/pin`).set(asUser('alice')).send({ isPinned: true }).expect(200);
        expect(pin.body.data).toMatchObject({ conversationId, isPinned: true });

        const inboxAlice = await ctx.http().get(`${API}/conversations`).set(asUser('alice')).expect(200);
        expect(inboxAlice.body.data[0]).toMatchObject({ id: conversationId, isPinned: true });

        await ctx.http().delete(`${API}/conversations/${conversationId}/history`).set(asUser('alice')).expect(200);

        const aliceHistory = await ctx.http().get(`${API}/conversations/${conversationId}/messages`).set(asUser('alice')).expect(200);
        expect(aliceHistory.body.data).toHaveLength(0);
        const bobHistory = await ctx.http().get(`${API}/conversations/${conversationId}/messages`).set(asUser('bob')).expect(200);
        expect(bobHistory.body.data.length).toBeGreaterThan(0);
    });

    it('BR-28 / BR-38: blocking locks the DIRECT chat for both sides and cannot be hijacked', async () => {
        const bobSocket = await connect('bob');
        const blockedEvent = once<any>(bobSocket, 'userBlocked');

        await ctx.http().post(`${API}/friends/${bob.id}/block`).set(asUser('alice')).expect(201);
        expect(await blockedEvent).toMatchObject({ blockerId: alice.id, blockedId: bob.id, conversationId });

        // Người bị chặn không gửi được tin trong chat DIRECT
        const rejected = await send(bobSocket, { content: 'Bạn còn đó không?' });
        expect(rejected.ok).toBe(false);
        if (!rejected.ok) expect(rejected.error.errorCode).toBe('CONVERSATION_BLOCKED');

        // Trạng thái chặn theo góc nhìn từng người
        const asBob = await ctx.http().get(`${API}/conversations/${conversationId}`).set(asUser('bob')).expect(200);
        expect(asBob.body.data.blockStatus).toBe('BLOCKED_ME');
        const asAlice = await ctx.http().get(`${API}/conversations/${conversationId}`).set(asUser('alice')).expect(200);
        expect(asAlice.body.data.blockStatus).toBe('BLOCKED_BY_ME');

        // Không thể "chặn ngược" để chiếm lệnh chặn, cũng không thể tự bỏ chặn
        await ctx.http().post(`${API}/friends/${alice.id}/block`).set(asUser('bob')).expect(403);
        const unblockByBob = await ctx.http().post(`${API}/friends/${alice.id}/unblock`).set(asUser('bob'));
        expect(unblockByBob.status).toBeGreaterThanOrEqual(400);

        // Người chặn bỏ chặn -> chat mở lại
        const unblockedEvent = once<any>(bobSocket, 'userUnblocked');
        await ctx.http().post(`${API}/friends/${bob.id}/unblock`).set(asUser('alice')).expect(201);
        await unblockedEvent;
        const accepted = await send(bobSocket, { content: 'Cảm ơn đã bỏ chặn' });
        expect(accepted.ok).toBe(true);
    });
});
