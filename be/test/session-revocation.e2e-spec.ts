import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, Socket } from 'socket.io-client';
import {
    API,
    closeE2eApp,
    createE2eApp,
    createVerifiedUser,
    DeviceSession,
    E2eContext,
    login,
    me,
    refresh,
    refreshCookieOf,
} from './helpers/e2e-app.helper.js';
import type { User } from '../src/modules/users/entities/user.entity.js';

/**
 * Flow 2 - Bảo mật phiên đa thiết bị (FR-27, FR-49, BR-24, BR-27, BR-39):
 * đăng xuất từ xa, đổi mật khẩu đá thiết bị khác, đặt lại mật khẩu đá mọi thiết bị.
 * Thu hồi phải có hiệu lực ngay với access token, refresh cookie VÀ socket đang mở.
 */
describe('Multi-device session revocation (e2e)', () => {
    let ctx: E2eContext;
    let user: User;
    let password = 'Start@1234';
    let deviceA: DeviceSession;
    let deviceB: DeviceSession;
    const sockets: Socket[] = [];

    const connectSocket = (accessToken: string) =>
        new Promise<Socket>((resolve, reject) => {
            const socket = io(ctx.baseUrl, { auth: { token: accessToken }, transports: ['websocket'], reconnection: false });
            sockets.push(socket);
            socket.once('connect', () => resolve(socket));
            socket.once('connect_error', reject);
        });

    const waitForDisconnect = (socket: Socket, timeoutMs = 5000) =>
        new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Socket was not disconnected')), timeoutMs);
            socket.once('disconnect', (reason) => {
                clearTimeout(timer);
                resolve(reason);
            });
        });

    beforeAll(async () => {
        ctx = await createE2eApp();
        user = await createVerifiedUser(ctx, 'e2e_sess', password);
        deviceA = await login(ctx, user.username, password, 'e2e-device-a');
        deviceB = await login(ctx, user.username, password, 'e2e-device-b');
    });

    afterAll(async () => {
        sockets.forEach((s) => s.disconnect());
        await closeE2eApp(ctx, [user?.id]);
    });

    it('lists both devices and flags the current one', async () => {
        const res = await ctx.http()
            .get(`${API}/auth/sessions`)
            .set('X-Device-Id', deviceA.deviceId)
            .set('Authorization', `Bearer ${deviceA.accessToken}`)
            .expect(200);

        const sessions = res.body.data as Array<{ deviceId: string; isCurrentDevice: boolean }>;
        expect(sessions.map((s) => s.deviceId).sort()).toEqual(['e2e-device-a', 'e2e-device-b']);
        expect(sessions.find((s) => s.deviceId === 'e2e-device-a')?.isCurrentDevice).toBe(true);
    });

    it('remote logout kills the other device access token, refresh cookie and live socket immediately', async () => {
        const socketB = await connectSocket(deviceB.accessToken);
        const disconnected = waitForDisconnect(socketB);

        await ctx.http()
            .delete(`${API}/auth/sessions/${deviceB.deviceId}`)
            .set('X-Device-Id', deviceA.deviceId)
            .set('Authorization', `Bearer ${deviceA.accessToken}`)
            .expect(200);

        expect(await disconnected).toBe('io server disconnect');
        await me(ctx, deviceB.accessToken, deviceB.deviceId).expect(401);
        await refresh(ctx, deviceB).expect(401);

        // Thiết bị A không bị ảnh hưởng
        await me(ctx, deviceA.accessToken, deviceA.deviceId).expect(200);
    });

    it('change-password validates the current password and BR-39 strength rule', async () => {
        const wrong = await ctx.http()
            .post(`${API}/auth/change-password`)
            .set('X-Device-Id', deviceA.deviceId)
            .set('Authorization', `Bearer ${deviceA.accessToken}`)
            .send({ currentPassword: 'Wrong@1234', newPassword: 'Changed@5678', confirmPassword: 'Changed@5678' })
            .expect(401);
        expect(wrong.body.errorCode).toBe('INVALID_CURRENT_PASSWORD');

        await ctx.http()
            .post(`${API}/auth/change-password`)
            .set('X-Device-Id', deviceA.deviceId)
            .set('Authorization', `Bearer ${deviceA.accessToken}`)
            .send({ currentPassword: password, newPassword: 'weakpass', confirmPassword: 'weakpass' })
            .expect(400);
    });

    it('change-password logs out every OTHER device but keeps the current one', async () => {
        deviceB = await login(ctx, user.username, password, 'e2e-device-b');
        const socketB = await connectSocket(deviceB.accessToken);
        const disconnected = waitForDisconnect(socketB);

        const res = await ctx.http()
            .post(`${API}/auth/change-password`)
            .set('X-Device-Id', deviceA.deviceId)
            .set('Authorization', `Bearer ${deviceA.accessToken}`)
            .send({ currentPassword: password, newPassword: 'Changed@5678', confirmPassword: 'Changed@5678' })
            .expect(200);
        expect(res.body.data.revokedSessions).toBeGreaterThanOrEqual(1);

        expect(await disconnected).toBe('io server disconnect');
        await me(ctx, deviceB.accessToken, deviceB.deviceId).expect(401);
        await refresh(ctx, deviceB).expect(401);

        // Thiết bị hiện tại vẫn dùng được cả access token lẫn refresh cookie
        await me(ctx, deviceA.accessToken, deviceA.deviceId).expect(200);
        const rotated = await refresh(ctx, deviceA).expect(200);
        deviceA = { ...deviceA, accessToken: rotated.body.data.accessToken, cookie: refreshCookieOf(rotated) };

        await ctx.http().post(`${API}/auth/login`).send({ username: user.username, password }).expect(401);
        password = 'Changed@5678';
        await login(ctx, user.username, password, 'e2e-device-c');
    });

    it('reset-password via email link revokes the sessions of every device (BR-24)', async () => {
        await ctx.http().post(`${API}/auth/forgot-password`).send({ email: user.email }).expect(200);
        const link = ctx.lastMail(user.email!, 'password-reset')?.payload ?? '';
        const token = new URL(link).searchParams.get('token');
        expect(token).toBeTruthy();

        await ctx.http()
            .post(`${API}/auth/reset-password`)
            .send({ token, newPassword: 'Reset@9012', confirmPassword: 'Reset@9012' })
            .expect(200);

        await me(ctx, deviceA.accessToken, deviceA.deviceId).expect(401);
        await refresh(ctx, deviceA).expect(401);

        // Token đặt lại mật khẩu chỉ dùng được 1 lần
        await ctx.http()
            .post(`${API}/auth/reset-password`)
            .send({ token, newPassword: 'Again@9012', confirmPassword: 'Again@9012' })
            .expect(400);

        await login(ctx, user.username, 'Reset@9012', 'e2e-device-a');
    });
});
