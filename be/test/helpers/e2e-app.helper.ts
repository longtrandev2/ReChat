import { vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request, { Response } from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { User } from '../../src/modules/users/entities/user.entity.js';
import { RedisService } from '../../src/common/redis/redis.service.js';
import { MailService } from '../../src/common/mail/mail.service.js';
import { AppThrottlerGuard } from '../../src/common/guards/app-throttler.guard.js';
import { REFRESH_TOKEN_COOKIE_NAME } from '../../src/modules/auth/constants/auth-cookie.constants.js';

/** Email bị "chặn lại" thay vì gửi SMTP thật: test đọc OTP / link đặt lại mật khẩu từ đây */
export interface CapturedMail {
    kind: 'verification' | 'password-reset' | 'two-factor';
    to: string;
    payload: string; // OTP hoặc reset link
    purpose?: string;
}

export interface E2eContext {
    app: INestApplication;
    http: () => ReturnType<typeof request>;
    baseUrl: string;
    redis: RedisService;
    userRepo: Repository<User>;
    mailbox: CapturedMail[];
    /** Email gần nhất gửi tới địa chỉ `to` (tùy chọn lọc theo loại) */
    lastMail: (to: string, kind?: CapturedMail['kind']) => CapturedMail | undefined;
}

export const API = '/api/v1';

/**
 * Khởi tạo app e2e giống production (configureApp: prefix, cookie, envelope, filter) với MySQL + Redis thật.
 * - Tắt rate limit (5 req/phút cho auth) để chạy được nhiều flow liên tiếp
 * - Chặn gửi mail SMTP, lưu vào mailbox để đọc OTP
 */
export async function createE2eApp(): Promise<E2eContext> {
    vi.spyOn(AppThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

    const mailbox: CapturedMail[] = [];
    vi.spyOn(MailService.prototype, 'sendVerificationEmail').mockImplementation(async (to, _u, otp) => {
        mailbox.push({ kind: 'verification', to, payload: otp });
    });
    vi.spyOn(MailService.prototype, 'sendPasswordResetEmail').mockImplementation(async (to, _u, link) => {
        mailbox.push({ kind: 'password-reset', to, payload: link });
    });
    vi.spyOn(MailService.prototype, 'sendTwoFactorOtpEmail').mockImplementation(async (to, _u, otp, purpose) => {
        mailbox.push({ kind: 'two-factor', to, payload: otp, purpose });
    });

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address?.port;

    return {
        app,
        http: () => request(app.getHttpServer()),
        baseUrl: `http://localhost:${port}`,
        redis: app.get(RedisService),
        userRepo: app.get(getRepositoryToken(User)),
        mailbox,
        lastMail: (to, kind) => [...mailbox].reverse().find((m) => m.to === to && (!kind || m.kind === kind)),
    };
}

/** Username ngẫu nhiên (<= 20 ký tự theo BR-01) để các lần chạy không đụng dữ liệu cũ */
export const uniqueName = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 20);

/** Tạo nhanh user đã xác thực email trực tiếp trong DB */
export async function createVerifiedUser(ctx: E2eContext, prefix: string, password: string): Promise<User> {
    const username = uniqueName(prefix);
    return ctx.userRepo.save(
        ctx.userRepo.create({
            username,
            email: `${username}@e2e.rechat.test`,
            isEmailVerified: true,
            password: await bcrypt.hash(password, 10),
            displayName: username,
        }),
    );
}

/** Lấy cookie refresh token (`name=value`) từ header Set-Cookie */
export function refreshCookieOf(res: Response): string {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = raw?.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`));
    if (!cookie) throw new Error(`Response không set cookie ${REFRESH_TOKEN_COOKIE_NAME}`);
    return cookie.split(';')[0];
}

export interface DeviceSession {
    deviceId: string;
    accessToken: string;
    cookie: string;
}

/** Đăng nhập trên một thiết bị cụ thể (X-Device-Id) và trả về access token + refresh cookie */
export async function login(ctx: E2eContext, username: string, password: string, deviceId: string): Promise<DeviceSession> {
    const res = await ctx.http()
        .post(`${API}/auth/login`)
        .set('X-Device-Id', deviceId)
        .send({ username, password })
        .expect(200);
    return { deviceId, accessToken: res.body.data.accessToken, cookie: refreshCookieOf(res) };
}

/** Gọi /auth/refresh như trình duyệt: gửi cookie + X-Device-Id */
export function refresh(ctx: E2eContext, session: Pick<DeviceSession, 'deviceId' | 'cookie'>) {
    return ctx.http().post(`${API}/auth/refresh`).set('X-Device-Id', session.deviceId).set('Cookie', session.cookie);
}

/** GET /auth/me với access token: 200 nếu phiên còn hiệu lực, 401 nếu đã bị thu hồi */
export function me(ctx: E2eContext, accessToken: string, deviceId = 'e2e-device') {
    return ctx.http().get(`${API}/auth/me`).set('X-Device-Id', deviceId).set('Authorization', `Bearer ${accessToken}`);
}

export async function closeE2eApp(ctx: E2eContext | undefined, userIds: string[]): Promise<void> {
    if (!ctx) return;
    try {
        // Dọn dẹp best-effort: lỗi khóa ngoại khi xóa dữ liệu test không được làm hỏng kết quả test
        for (const id of userIds.filter(Boolean)) {
            await ctx.redis.deleteAllUserSessions(id).catch(() => undefined);
            await ctx.userRepo.delete({ id }).catch(() => undefined);
        }
    } finally {
        await ctx.app.close();
        vi.restoreAllMocks();
    }
}
