import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private client: Redis;

    constructor(private readonly configService: ConfigService) {
        const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
        const port = Number(this.configService.get<number>('REDIS_PORT')) || 6379;
        const password = this.configService.get<string>('REDIS_PASSWORD');

        this.client = new Redis({
            host,
            port,
            password: password || undefined,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 3000);
                return delay;
            },
        });

        this.client.on('error', (err) => {
            this.logger.warn(`Redis connection error: ${err.message}`);
        });

        this.client.on('connect', () => {
            this.logger.log(`Connected to Redis at ${host}:${port}`);
        });
    }

    async onModuleInit() {
        try {
            await this.client.connect();
        } catch (error: any) {
            this.logger.warn(`Failed to connect to Redis initially: ${error.message}. Operations will retry when needed.`);
        }
    }

    async onModuleDestroy() {
        try {
            await this.client.quit();
            this.logger.log('Disconnected from Redis');
        } catch (error: any) {
            this.logger.warn(`Error disconnecting Redis: ${error.message}`);
        }
    }

    getClient(): Redis {
        return this.client;
    }

    // Key-Value operations
    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
        if (ttlSeconds && ttlSeconds > 0) {
            return this.client.set(key, value, 'EX', ttlSeconds);
        }
        return this.client.set(key, value);
    }

    async del(...keys: string[]): Promise<number> {
        if (!keys.length) return 0;
        return this.client.del(...keys);
    }

    async exists(...keys: string[]): Promise<number> {
        if (!keys.length) return 0;
        return this.client.exists(...keys);
    }

    async expire(key: string, seconds: number): Promise<number> {
        return this.client.expire(key, seconds);
    }

    // Hash operations (Session Management)
    async hset(key: string, field: string, value: string): Promise<number>;
    async hset(key: string, object: Record<string, any>): Promise<number>;
    async hset(key: string, arg1: any, arg2?: any): Promise<number> {
        if (typeof arg1 === 'object') {
            return this.client.hset(key, arg1);
        }
        return this.client.hset(key, arg1, arg2);
    }

    async hget(key: string, field: string): Promise<string | null> {
        return this.client.hget(key, field);
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        return this.client.hgetall(key);
    }

    async hdel(key: string, ...fields: string[]): Promise<number> {
        if (!fields.length) return 0;
        return this.client.hdel(key, ...fields);
    }

    // Set operations (Device indexes / Tags)
    async sadd(key: string, ...members: string[]): Promise<number> {
        if (!members.length) return 0;
        return this.client.sadd(key, ...members);
    }

    async smembers(key: string): Promise<string[]> {
        return this.client.smembers(key);
    }

    async srem(key: string, ...members: string[]): Promise<number> {
        if (!members.length) return 0;
        return this.client.srem(key, ...members);
    }

    // Token Blacklist operations
    async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
        if (ttlSeconds > 0) {
            await this.client.set(`auth:blacklist:${token}`, '1', 'EX', ttlSeconds);
        }
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {
        const result = await this.client.exists(`auth:blacklist:${token}`);
        return result === 1;
    }

    // Multi-Device Session Management
    async saveSession(
        userId: string,
        deviceId: string,
        sessionData: Record<string, any>,
        ttlSeconds: number = 604800, // 7 days
    ): Promise<void> {
        const sessionKey = `auth:session:${userId}:${deviceId}`;
        const userSessionsKey = `auth:user_sessions:${userId}`;
        const serialized = JSON.stringify({
            ...sessionData,
            deviceId,
            lastActiveAt: new Date().toISOString(),
        });

        await this.client.set(sessionKey, serialized, 'EX', ttlSeconds);
        await this.client.sadd(userSessionsKey, deviceId);
        await this.client.expire(userSessionsKey, ttlSeconds);
    }

    async getSession(userId: string, deviceId: string): Promise<Record<string, any> | null> {
        const data = await this.client.get(`auth:session:${userId}:${deviceId}`);
        return data ? JSON.parse(data) : null;
    }

    async getUserSessions(userId: string): Promise<Record<string, any>[]> {
        const userSessionsKey = `auth:user_sessions:${userId}`;
        const deviceIds = await this.client.smembers(userSessionsKey);
        if (!deviceIds.length) return [];

        const sessions: Record<string, any>[] = [];
        const expiredDeviceIds: string[] = [];

        for (const deviceId of deviceIds) {
            const data = await this.client.get(`auth:session:${userId}:${deviceId}`);
            if (data) {
                sessions.push(JSON.parse(data));
            } else {
                expiredDeviceIds.push(deviceId);
            }
        }

        if (expiredDeviceIds.length > 0) {
            await this.client.srem(userSessionsKey, ...expiredDeviceIds);
        }

        return sessions;
    }

    async deleteSession(userId: string, deviceId: string): Promise<void> {
        await this.client.del(`auth:session:${userId}:${deviceId}`);
        await this.client.srem(`auth:user_sessions:${userId}`, deviceId);
    }

    async deleteAllUserSessions(userId: string): Promise<void> {
        const userSessionsKey = `auth:user_sessions:${userId}`;
        const deviceIds = await this.client.smembers(userSessionsKey);
        if (deviceIds.length > 0) {
            const keys = deviceIds.map((d) => `auth:session:${userId}:${d}`);
            await this.client.del(...keys);
        }
        await this.client.del(userSessionsKey);
    }
}
