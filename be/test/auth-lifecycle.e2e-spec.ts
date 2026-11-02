import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, closeE2eApp, createE2eApp, E2eContext, me, refresh, refreshCookieOf, uniqueName } from './helpers/e2e-app.helper.js';

/**
 * Flow 1 - Vòng đời xác thực (FR-01, FR-02, FR-24, BR-02, BR-22, BR-23, BR-33, BR-35):
 * đăng ký -> xác thực email OTP -> đăng nhập (HttpOnly cookie) -> refresh xoay vòng (RTR)
 * -> phát hiện tái sử dụng token cũ (reuse detection) -> đăng xuất thu hồi phiên.
 */
describe('Auth lifecycle (e2e)', () => {
    let ctx: E2eContext;
    const username = uniqueName('e2e_life');
    const email = `${username}@e2e.rechat.test`;
    const password = 'Lifecycle@123';
    const deviceId = 'e2e-lifecycle-device';
    let userId = '';

    beforeAll(async () => {
        ctx = await createE2eApp();
    });

    afterAll(async () => {
        await closeE2eApp(ctx, [userId]);
    });

    it('registers, refuses login before email verification, then verifies with the emailed OTP', async () => {
        await ctx.http()
            .post(`${API}/auth/register`)
            .send({ username, email, password, confirmPassword: password })
            .expect(201);

        const otp = ctx.lastMail(email, 'verification')?.payload;
        expect(otp).toMatch(/^\d{6}$/);

        // BR-23: chưa xác thực email thì không được đăng nhập
        await ctx.http().post(`${API}/auth/login`).send({ username, password }).expect(403);

        // Sai OTP -> 400
        await ctx.http().post(`${API}/auth/verify-email`).send({ email, otp: otp === '000000' ? '111111' : '000000' }).expect(400);

        const verified = await ctx.http()
            .post(`${API}/auth/verify-email`)
            .set('X-Device-Id', deviceId)
            .send({ email, otp })
            .expect(200);

        // Cấp token chuẩn: access token trong body, refresh token CHỈ nằm trong cookie HttpOnly
        expect(verified.body.data.accessToken).toBeTruthy();
        expect(verified.body.data).not.toHaveProperty('refreshToken');
        expect(refreshCookieOf(verified)).toBeTruthy();
        expect(verified.headers['set-cookie'][0]).toMatch(/HttpOnly/i);

        userId = verified.body.data.user.id;
        expect(verified.body.data.user).toMatchObject({ email, isEmailVerified: true, twoFactorEnabled: false });
    });

    it('logs in with email as identifier and exposes the full profile via /auth/me', async () => {
        const res = await ctx.http()
            .post(`${API}/auth/login`)
            .set('X-Device-Id', deviceId)
            .send({ username: email, password })
            .expect(200);

        const profile = await me(ctx, res.body.data.accessToken, deviceId).expect(200);
        expect(profile.body.data).toMatchObject({ username, email, isEmailVerified: true });
        expect(profile.body.data).not.toHaveProperty('password');
    });

    it('rotates the refresh token and detects reuse of a rotated token (token theft)', async () => {
        const login = await ctx.http()
            .post(`${API}/auth/login`)
            .set('X-Device-Id', deviceId)
            .send({ username, password })
            .expect(200);
        const firstCookie = refreshCookieOf(login);

        const rotated = await refresh(ctx, { deviceId, cookie: firstCookie }).expect(200);
        const secondCookie = refreshCookieOf(rotated);
        expect(secondCookie).not.toBe(firstCookie);
        expect(rotated.body.data.user.email).toBe(email);

        // Bỏ qua 30s grace period để mô phỏng kẻ gian dùng lại cookie cũ sau đó
        const oldTokenId = decodeURIComponent(firstCookie.split('=')[1]).split('.')[0];
        await ctx.redis.del(`auth:grace:${oldTokenId}`);

        const reuse = await refresh(ctx, { deviceId, cookie: firstCookie }).expect(403);
        expect(reuse.body.errorCode).toBe('SECURITY_TOKEN_THEFT_DETECTED');

        // Toàn bộ family bị hủy: cả cookie mới nhất cũng không dùng được nữa
        await refresh(ctx, { deviceId, cookie: secondCookie }).expect(401);
    });

    it('rejects a refresh cookie replayed from another device (device binding)', async () => {
        const login = await ctx.http()
            .post(`${API}/auth/login`)
            .set('X-Device-Id', deviceId)
            .send({ username, password })
            .expect(200);

        await refresh(ctx, { deviceId: 'attacker-device', cookie: refreshCookieOf(login) }).expect(401);
    });

    it('logout blacklists the access token and revokes the refresh cookie', async () => {
        const login = await ctx.http()
            .post(`${API}/auth/login`)
            .set('X-Device-Id', deviceId)
            .send({ username, password })
            .expect(200);
        const accessToken = login.body.data.accessToken;
        const cookie = refreshCookieOf(login);

        await ctx.http()
            .post(`${API}/auth/logout`)
            .set('X-Device-Id', deviceId)
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Cookie', cookie)
            .expect(200);

        await me(ctx, accessToken, deviceId).expect(401);
        await refresh(ctx, { deviceId, cookie }).expect(401);
    });
});
