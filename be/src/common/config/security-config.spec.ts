import { afterEach, describe, expect, it, vi } from 'vitest';
import { corsOriginCallback, getAllowedOrigins, getPrimaryClientUrl } from './cors-origins.js';
import { getJwtSecret } from './jwt-secret.js';
import { generateOtp } from '../utils/generate-otp.js';

describe('Security config helpers', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('CORS whitelist (corsOriginCallback)', () => {
        const check = (origin?: string) => {
            const cb = vi.fn();
            corsOriginCallback(origin, cb);
            return cb.mock.calls[0];
        };

        it('reads multiple comma separated origins from CLIENT_URL and trims trailing slashes', () => {
            process.env.CLIENT_URL = 'https://app.rechat.vn/, http://localhost:5173';
            expect(getAllowedOrigins()).toEqual(['https://app.rechat.vn', 'http://localhost:5173']);
        });

        it('allows whitelisted origins and requests without an Origin header', () => {
            process.env.CLIENT_URL = 'https://app.rechat.vn';
            expect(check('https://app.rechat.vn')).toEqual([null, true]);
            expect(check(undefined)).toEqual([null, true]);
        });

        it('uses only the first origin as the primary client URL for email links (M5)', () => {
            expect(getPrimaryClientUrl('https://app.rechat.vn/, http://localhost:5173')).toBe('https://app.rechat.vn');
            expect(getPrimaryClientUrl(undefined)).toBe('http://localhost:5173');
        });

        it('rejects any origin outside the whitelist (no more reflecting every origin)', () => {
            process.env.CLIENT_URL = 'https://app.rechat.vn';
            expect(check('https://evil.example.com')).toEqual([null, false]);
        });
    });

    describe('getJwtSecret', () => {
        const config = (value?: string) => ({ get: vi.fn().mockReturnValue(value) }) as any;

        it('returns the configured secret', () => {
            expect(getJwtSecret(config('super-secret'))).toBe('super-secret');
        });

        it('throws in production when JWT_SECRET is missing', () => {
            process.env.NODE_ENV = 'production';
            expect(() => getJwtSecret(config(undefined))).toThrow('JWT_SECRET');
        });

        it('falls back to a dev-only secret outside production', () => {
            process.env.NODE_ENV = 'development';
            expect(getJwtSecret(config(''))).toContain('dev-only');
        });
    });

    describe('generateOtp', () => {
        it('always returns exactly 6 digits', () => {
            for (let i = 0; i < 200; i++) {
                expect(generateOtp()).toMatch(/^\d{6}$/);
            }
        });
    });
});
