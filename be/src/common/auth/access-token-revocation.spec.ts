import { describe, expect, it, vi } from 'vitest';
import { getAccessTokenRevocationReason } from './access-token-revocation.js';

const redisWith = (values: Record<string, string>) =>
    ({
        isTokenBlacklisted: vi.fn().mockResolvedValue(false),
        get: vi.fn(async (key: string) => values[key] ?? null),
    }) as any;

describe('getAccessTokenRevocationReason (M1: millisecond precision)', () => {
    const marker = 1_800_000_005_900; // thu hồi lúc 05.900s

    it('rejects a token issued in the SAME second but before the marker when iatMs is present', async () => {
        const redis = redisWith({ 'auth:device_min_issued_at:u1:d1': String(marker) });
        const reason = await getAccessTokenRevocationReason(redis, {
            sub: 'u1',
            did: 'd1',
            iat: 1_800_000_005,
            iatMs: 1_800_000_005_100,
        });
        expect(reason).toContain('đăng xuất từ xa');
    });

    it('accepts a token issued after the marker', async () => {
        const redis = redisWith({ 'auth:device_min_issued_at:u1:d1': String(marker) });
        const reason = await getAccessTokenRevocationReason(redis, {
            sub: 'u1',
            did: 'd1',
            iat: 1_800_000_006,
            iatMs: 1_800_000_006_000,
        });
        expect(reason).toBeNull();
    });

    it('legacy tokens (iat only) are compared at second granularity and not rejected for the same second', async () => {
        const redis = redisWith({ 'auth:user_min_issued_at:u1': String(marker) });
        expect(await getAccessTokenRevocationReason(redis, { sub: 'u1', iat: 1_800_000_005 })).toBeNull();
        expect(await getAccessTokenRevocationReason(redis, { sub: 'u1', iat: 1_800_000_004 })).toContain('hủy từ xa');
    });

    it('rejects blacklisted JTIs', async () => {
        const redis = redisWith({});
        redis.isTokenBlacklisted.mockImplementation(async (key: string) => key === 'jti-1');
        expect(await getAccessTokenRevocationReason(redis, { sub: 'u1', jti: 'jti-1' })).toContain('thu hồi');
    });
});
