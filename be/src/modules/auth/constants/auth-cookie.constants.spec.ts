import { describe, expect, it } from 'vitest';
import {
    ACCESS_TOKEN_TTL_SECONDS,
    getClearRefreshTokenCookieOptions,
    getRefreshTokenCookieOptions,
    REFRESH_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_GRACE_PERIOD_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS,
} from './auth-cookie.constants.js';

describe('Auth Cookie Constants & Helpers', () => {
    it('should have standard secure constants', () => {
        expect(REFRESH_TOKEN_COOKIE_NAME).toBe('rechat_refresh_token');
        expect(REFRESH_TOKEN_TTL_SECONDS).toBe(30 * 24 * 60 * 60); // 30 days
        expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60); // 15 mins = 900s
        expect(REFRESH_TOKEN_GRACE_PERIOD_SECONDS).toBe(30); // 30s Grace Period
    });

    it('should return secure cookie options for development', () => {
        const options = getRefreshTokenCookieOptions(false);
        expect(options.httpOnly).toBe(true);
        expect(options.secure).toBe(false);
        expect(options.sameSite).toBe('lax');
        expect(options.path).toBe('/api/v1/auth');
        expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should return strict/secure cookie options for production', () => {
        const options = getRefreshTokenCookieOptions(true);
        expect(options.httpOnly).toBe(true);
        expect(options.secure).toBe(true);
        expect(options.sameSite).toBe('strict');
        expect(options.path).toBe('/api/v1/auth');
    });

    it('should return zero maxAge and past epoch date for clear cookie options', () => {
        const options = getClearRefreshTokenCookieOptions(false);
        expect(options.httpOnly).toBe(true);
        expect(options.maxAge).toBe(0);
        expect(options.expires).toEqual(new Date(0));
        expect(options.path).toBe('/api/v1/auth');
    });
});
