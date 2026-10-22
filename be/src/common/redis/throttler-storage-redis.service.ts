import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service.js';

export interface ThrottlerStorageRecord {
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
}

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
    private readonly logger = new Logger(ThrottlerStorageRedisService.name);

    constructor(private readonly redisService: RedisService) { }

    async increment(
        key: string,
        ttl: number, // in milliseconds
        limit: number,
        blockDuration: number, // in milliseconds
        throttlerName: string,
    ): Promise<ThrottlerStorageRecord> {
        const redisKey = `throttle:${throttlerName}:${key}`;
        const blockKey = `throttle_block:${throttlerName}:${key}`;
        const client = this.redisService.getClient();

        try {
            // Kiểm tra xem IP/key có đang bị block không
            const isBlockedValue = await client.get(blockKey);
            if (isBlockedValue) {
                const timeToBlockExpire = await client.pttl(blockKey);
                return {
                    totalHits: limit + 1,
                    timeToExpire: 0,
                    isBlocked: true,
                    timeToBlockExpire: Math.max(0, timeToBlockExpire),
                };
            }

            // Tăng số lượt gọi (INCR)
            const totalHits = await client.incr(redisKey);

            // Nếu đây là hit đầu tiên, đặt TTL (chuyển ms sang giây làm tròn lên)
            if (totalHits === 1) {
                await client.pexpire(redisKey, ttl);
            }

            const timeToExpire = await client.pttl(redisKey);

            // Nếu vượt quá limit và có cấu hình blockDuration
            let isBlocked = false;
            let timeToBlockExpire = 0;

            if (totalHits > limit) {
                isBlocked = true;
                if (blockDuration > 0) {
                    await client.set(blockKey, '1', 'PX', blockDuration);
                    timeToBlockExpire = blockDuration;
                }
            }

            return {
                totalHits,
                timeToExpire: Math.max(0, timeToExpire),
                isBlocked,
                timeToBlockExpire,
            };
        } catch (error: any) {
            this.logger.warn(`Redis throttling error for key ${key}: ${error.message}. Allowing request.`);
            // Fallback: nếu Redis có lỗi kết nối, cho phép request đi qua an toàn
            return {
                totalHits: 1,
                timeToExpire: ttl,
                isBlocked: false,
                timeToBlockExpire: 0,
            };
        }
    }
}
