import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { API, closeE2eApp, createE2eApp, createVerifiedUser, E2eContext, login } from './helpers/e2e-app.helper.js';
import type { User } from '../src/modules/users/entities/user.entity.js';
import { Message, MessageType } from '../src/modules/conversations/entities/message.entity.js';
import { Conversation } from '../src/modules/conversations/entities/conversation.entity.js';
import { ConversationsService } from '../src/modules/conversations/conversations.service.js';
import { Friendship, FriendshipStatus } from '../src/modules/friends/entities/friendship.entity.js';

/**
 * Flow 4 - Phân quyền hội thoại & phân trang con trỏ (FR-07, FR-13, BR-05, BR-08):
 * chat 1-1 không bị nhân bản, người ngoài không đọc được tin nhắn, cursor pagination không trùng / không sót.
 */
describe('Conversation access control & cursor pagination (e2e)', () => {
    let ctx: E2eContext;
    let messageRepo: Repository<Message>;
    let conversationRepo: Repository<Conversation>;
    let conversations: ConversationsService;
    let friendshipRepo: Repository<Friendship>;
    let alice: User;
    let bob: User;
    let outsider: User;
    const tokens: Record<string, string> = {};
    let conversationId = '';
    const password = 'Convers@123';

    const asUser = (name: string) => ({ Authorization: `Bearer ${tokens[name]}`, 'X-Device-Id': `e2e-${name}` });

    /** Đọc toàn bộ lịch sử theo từng trang `before` cursor */
    const readAllPages = async (limit: number) => {
        const collected: string[] = [];
        let before: string | undefined;
        for (let page = 0; page < 50; page++) {
            const res = await ctx.http()
                .get(`${API}/conversations/${conversationId}/messages`)
                .query(before ? { limit, before } : { limit })
                .set(asUser('alice'))
                .expect(200);
            const items = res.body.data as Array<{ id: string }>;
            if (items.length === 0) break;
            collected.unshift(...items.map((m) => m.id)); // mỗi trang trả về theo thứ tự thời gian tăng dần
            before = items[0].id;
            if (items.length < limit) break;
        }
        return collected;
    };

    beforeAll(async () => {
        ctx = await createE2eApp();
        messageRepo = ctx.app.get(getRepositoryToken(Message));
        conversationRepo = ctx.app.get(getRepositoryToken(Conversation));
        conversations = ctx.app.get(ConversationsService);
        friendshipRepo = ctx.app.get(getRepositoryToken(Friendship));

        alice = await createVerifiedUser(ctx, 'e2e_alice', password);
        bob = await createVerifiedUser(ctx, 'e2e_bob', password);
        outsider = await createVerifiedUser(ctx, 'e2e_out', password);
        // Chat 1-1 chỉ mở được giữa bạn bè đã chấp nhận
        await friendshipRepo.save(friendshipRepo.create({ requester: alice, addressee: bob, status: FriendshipStatus.ACCEPTED }));
        tokens.alice = (await login(ctx, alice.username, password, 'e2e-alice')).accessToken;
        tokens.outsider = (await login(ctx, outsider.username, password, 'e2e-outsider')).accessToken;
    });

    afterAll(async () => {
        if (conversationId) {
            await messageRepo.delete({ conversation: { id: conversationId } });
            await conversationRepo.delete({ id: conversationId }).catch(() => undefined);
        }
        if (alice?.id) await friendshipRepo.delete({ requester: { id: alice.id } }).catch(() => undefined);
        await closeE2eApp(ctx, [alice?.id, bob?.id, outsider?.id]);
    });

    it('opening a direct chat twice returns the same conversation (BR-05)', async () => {
        const first = await ctx.http().post(`${API}/conversations/direct`).set(asUser('alice')).send({ targetUserId: bob.id });
        expect([200, 201]).toContain(first.status);
        conversationId = first.body.data.id;

        const second = await ctx.http().post(`${API}/conversations/direct`).set(asUser('alice')).send({ targetUserId: bob.id });
        expect(second.body.data.id).toBe(conversationId);
    });

    it('a non-member cannot read the conversation history (BR-08)', async () => {
        await ctx.http().get(`${API}/conversations/${conversationId}/messages`).set(asUser('outsider')).expect(403);
    });

    it('pages through the history with the before-cursor without duplicates or gaps', async () => {
        const sentIds: string[] = [];
        for (let i = 1; i <= 12; i++) {
            const message = await conversations.createMessage(alice.id, {
                conversationId,
                content: `Tin nhắn số ${i}`,
                type: MessageType.TEXT,
            });
            sentIds.push(message.id);
        }

        const pagedIds = await readAllPages(5);
        expect(pagedIds).toEqual(sentIds);

        // Không bao giờ lộ hash mật khẩu của người gửi (regression: sender được join nguyên entity User)
        const page = await ctx.http().get(`${API}/conversations/${conversationId}/messages`).set(asUser('alice')).expect(200);
        expect(JSON.stringify(page.body)).not.toContain('"password"');
    });

    it('keeps messages that share the exact same createdAt when they straddle a page boundary', async () => {
        // Insert nhiều dòng trong MỘT câu lệnh => cùng CURRENT_TIMESTAMP(6) (vd: tin nhắn hệ thống tạo đồng thời)
        await messageRepo
            .createQueryBuilder()
            .insert()
            .into(Message)
            .values(
                [1, 2, 3, 4].map((i) => ({
                    content: `Tin nhắn trùng thời điểm ${i}`,
                    type: MessageType.TEXT,
                    conversation: { id: conversationId },
                    sender: { id: alice.id },
                })),
            )
            .execute();

        const total = await messageRepo.count({ where: { conversation: { id: conversationId } } });
        const pagedIds = await readAllPages(3);

        expect(new Set(pagedIds).size).toBe(pagedIds.length);
        expect(pagedIds).toHaveLength(total);
    });
});
