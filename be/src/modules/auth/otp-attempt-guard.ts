import { BadRequestException } from '@nestjs/common';
import type { RedisService } from '../../common/redis/redis.service.js';

/** Số lần thử OTP tối đa trước khi hủy mã (BR-25) */
export const MAX_OTP_ATTEMPTS = 5;

export interface OtpAttemptOptions {
    /** Key lưu mã OTP (bị xóa khi vượt quá số lượt thử) */
    otpKey: string;
    /** Key bộ đếm lượt thử */
    counterKey: string;
    /** TTL của bộ đếm, nên bằng TTL của OTP */
    ttlSeconds: number;
    /** Mã người dùng nhập có khớp OTP hay không */
    isMatch: boolean;
    exceededMessage: string;
    wrongMessage: string;
}

/**
 * Kiểm tra một lượt thử OTP với bộ đếm nguyên tử (Redis INCR).
 * Lượt thử được đếm TRƯỚC khi so khớp mã, nên N request song song không thể cùng đọc một giá trị cũ
 * để vượt giới hạn. Đạt MAX_OTP_ATTEMPTS lượt sai: hủy OTP (bắt buộc xin mã mới).
 * Thành công: xóa bộ đếm. Sai: ném BadRequestException.
 */
export async function assertOtpAttempt(redisService: RedisService, options: OtpAttemptOptions): Promise<void> {
    const { otpKey, counterKey, ttlSeconds, isMatch, exceededMessage, wrongMessage } = options;
    const attempts = await redisService.incr(counterKey, ttlSeconds);

    if (attempts > MAX_OTP_ATTEMPTS) {
        await redisService.del(otpKey, counterKey);
        throw new BadRequestException(exceededMessage);
    }

    if (isMatch) {
        await redisService.del(counterKey);
        return;
    }

    if (attempts >= MAX_OTP_ATTEMPTS) {
        await redisService.del(otpKey, counterKey);
        throw new BadRequestException(exceededMessage);
    }

    throw new BadRequestException(wrongMessage);
}
