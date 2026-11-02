import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { assertOtpAttempt } from './otp-attempt-guard.js';

const options = (isMatch: boolean) => ({
    otpKey: 'otp:k',
    counterKey: 'otp:attempts:k',
    ttlSeconds: 300,
    isMatch,
    exceededMessage: 'quá 5 lần',
    wrongMessage: 'sai mã',
});

const redisWithAttempt = (attempt: number) =>
    ({ incr: vi.fn().mockResolvedValue(attempt), del: vi.fn().mockResolvedValue(1) }) as any;

describe('assertOtpAttempt (M4: atomic attempt counter)', () => {
    it('counts the attempt BEFORE comparing and clears the counter on success', async () => {
        const redis = redisWithAttempt(1);
        await expect(assertOtpAttempt(redis, options(true))).resolves.toBeUndefined();
        expect(redis.incr).toHaveBeenCalledWith('otp:attempts:k', 300);
        expect(redis.del).toHaveBeenCalledWith('otp:attempts:k');
    });

    it('throws the wrong-code message below the limit without burning the OTP', async () => {
        const redis = redisWithAttempt(4);
        await expect(assertOtpAttempt(redis, options(false))).rejects.toThrow('sai mã');
        expect(redis.del).not.toHaveBeenCalled();
    });

    it('burns the OTP on the 5th wrong attempt', async () => {
        const redis = redisWithAttempt(5);
        await expect(assertOtpAttempt(redis, options(false))).rejects.toThrow('quá 5 lần');
        expect(redis.del).toHaveBeenCalledWith('otp:k', 'otp:attempts:k');
    });

    it('rejects parallel attempts beyond the limit even if the code is correct', async () => {
        const redis = redisWithAttempt(6);
        await expect(assertOtpAttempt(redis, options(true))).rejects.toBeInstanceOf(BadRequestException);
        expect(redis.del).toHaveBeenCalledWith('otp:k', 'otp:attempts:k');
    });
});
