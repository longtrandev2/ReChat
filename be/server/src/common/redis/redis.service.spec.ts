import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service.js';
import RedisMock from 'ioredis-mock';

describe('RedisService', () => {
    let service: RedisService;
    let configService: ConfigService;

    beforeEach(() => {
        configService = {
            get: vi.fn((key: string) => {
                if (key === 'REDIS_HOST') return 'localhost';
                if (key === 'REDIS_PORT') return 6379;
                return undefined;
            }),
        } as unknown as ConfigService;

        service = new RedisService(configService);
        // Thay thế client bằng RedisMock để test in-memory
        (service as any).client = new (RedisMock as any)();
    });

    it('should set and get key-value pair', async () => {
        await service.set('test:key', 'hello', 60);
        const val = await service.get('test:key');
        expect(val).toBe('hello');
    });

    it('should check existence and delete key', async () => {
        await service.set('test:del', 'world');
        expect(await service.exists('test:del')).toBe(1);

        await service.del('test:del');
        expect(await service.exists('test:del')).toBe(0);
    });

    it('should handle hash operations (hset, hget, hgetall, hdel)', async () => {
        await service.hset('session:1', 'deviceId', 'web-chrome');
        await service.hset('session:1', 'ip', '127.0.0.1');

        const devId = await service.hget('session:1', 'deviceId');
        expect(devId).toBe('web-chrome');

        const all = await service.hgetall('session:1');
        expect(all).toEqual({
            deviceId: 'web-chrome',
            ip: '127.0.0.1',
        });

        await service.hdel('session:1', 'ip');
        const remaining = await service.hgetall('session:1');
        expect(remaining).toEqual({
            deviceId: 'web-chrome',
        });
    });

    it('should handle set operations (sadd, smembers, srem)', async () => {
        await service.sadd('user_devices:user1', 'dev1', 'dev2');
        const members = await service.smembers('user_devices:user1');
        expect(members).toContain('dev1');
        expect(members).toContain('dev2');

        await service.srem('user_devices:user1', 'dev1');
        const afterRem = await service.smembers('user_devices:user1');
        expect(afterRem).not.toContain('dev1');
        expect(afterRem).toContain('dev2');
    });
});
