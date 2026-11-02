import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    API,
    closeE2eApp,
    createE2eApp,
    createVerifiedUser,
    E2eContext,
    login,
    me,
    refreshCookieOf,
} from './helpers/e2e-app.helper.js';
import type { User } from '../src/modules/users/entities/user.entity.js';

/**
 * Flow 3 - Xác thực 2 bước qua Email OTP (FR-25, FR-26, BR-25):
 * bật 2FA -> đăng nhập gặp challenge -> chống brute-force 5 lần -> xác thực thành công -> tắt 2FA.
 */
describe('Two-factor authentication (e2e)', () => {
    let ctx: E2eContext;
    let user: User;
    const password = 'TwoFactor@123';
    const deviceId = 'e2e-2fa-device';
    let accessToken = '';

    const auth = (req: ReturnType<ReturnType<E2eContext['http']>['post']>) =>
        req.set('X-Device-Id', deviceId).set('Authorization', `Bearer ${accessToken}`);

    const startLoginChallenge = async () => {
        const res = await ctx.http().post(`${API}/auth/login`).set('X-Device-Id', deviceId).send({ username: user.username, password }).expect(200);
        expect(res.body.data).toMatchObject({ requires2FA: true });
        expect(res.body.data).not.toHaveProperty('accessToken');
        const otp = ctx.lastMail(user.email!, 'two-factor')?.payload ?? '';
        return { mfaToken: res.body.data.mfaToken as string, otp };
    };

    const wrongOtp = (otp: string) => (otp === '000000' ? '111111' : '000000');

    beforeAll(async () => {
        ctx = await createE2eApp();
        user = await createVerifiedUser(ctx, 'e2e_2fa', password);
        accessToken = (await login(ctx, user.username, password, deviceId)).accessToken;
    });

    afterAll(async () => {
        await closeE2eApp(ctx, [user?.id]);
    });

    it('enables 2FA after confirming the setup OTP sent by email', async () => {
        await auth(ctx.http().post(`${API}/auth/2fa/send-setup-otp`)).expect(200);
        const setupOtp = ctx.lastMail(user.email!, 'two-factor');
        expect(setupOtp?.purpose).toBe('setup');

        await auth(ctx.http().post(`${API}/auth/2fa/enable`)).send({ otp: wrongOtp(setupOtp!.payload) }).expect(400);
        await auth(ctx.http().post(`${API}/auth/2fa/enable`)).send({ otp: setupOtp!.payload }).expect(200);

        const profile = await me(ctx, accessToken, deviceId).expect(200);
        expect(profile.body.data.twoFactorEnabled).toBe(true);
    });

    it('cancels the login challenge after 5 wrong OTPs, even if the right code is sent afterwards (BR-25)', async () => {
        const { mfaToken, otp } = await startLoginChallenge();

        for (let attempt = 1; attempt <= 4; attempt++) {
            const res = await ctx.http().post(`${API}/auth/2fa/verify-login`).send({ mfaToken, otp: wrongOtp(otp) }).expect(400);
            expect(res.body.message).toContain('không chính xác');
        }
        const fifth = await ctx.http().post(`${API}/auth/2fa/verify-login`).send({ mfaToken, otp: wrongOtp(otp) }).expect(400);
        expect(fifth.body.message).toContain('quá 5 lần');

        await ctx.http().post(`${API}/auth/2fa/verify-login`).send({ mfaToken, otp }).expect(400);
    });

    it('issues tokens and the refresh cookie after a correct OTP', async () => {
        const { mfaToken, otp } = await startLoginChallenge();

        const res = await ctx.http()
            .post(`${API}/auth/2fa/verify-login`)
            .set('X-Device-Id', deviceId)
            .send({ mfaToken, otp })
            .expect(200);

        expect(res.body.data.accessToken).toBeTruthy();
        expect(refreshCookieOf(res)).toBeTruthy();
        accessToken = res.body.data.accessToken;
    });

    it('disables 2FA only with the correct account password (regression: used to return 500)', async () => {
        const wrong = await auth(ctx.http().post(`${API}/auth/2fa/disable`)).send({ password: 'Wrong@1234' }).expect(401);
        expect(wrong.body.errorCode).toBe('INVALID_CURRENT_PASSWORD');

        await auth(ctx.http().post(`${API}/auth/2fa/disable`)).send({ password }).expect(200);

        const profile = await me(ctx, accessToken, deviceId).expect(200);
        expect(profile.body.data.twoFactorEnabled).toBe(false);

        // Đăng nhập lại không còn bước 2FA
        await login(ctx, user.username, password, deviceId);
    });
});
