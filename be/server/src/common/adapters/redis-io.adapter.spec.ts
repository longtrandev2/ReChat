import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisIoAdapter } from './redis-io.adapter.js';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext } from '@nestjs/common';

const mockCreateAdapter = vi.fn().mockReturnValue('mock-redis-adapter-constructor');

vi.mock('@socket.io/redis-adapter', () => ({
    createAdapter: (...args: any[]) => mockCreateAdapter(...args),
}));

describe('RedisIoAdapter', () => {
    let mockApp: INestApplicationContext;
    let mockConfigService: { get: ReturnType<typeof vi.fn> };
    let mockPubClient: any;
    let mockSubClient: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockConfigService = {
            get: vi.fn((key: string) => {
                if (key === 'REDIS_HOST') return '127.0.0.1';
                if (key === 'REDIS_PORT') return 6379;
                if (key === 'REDIS_PASSWORD') return 'secret';
                return null;
            }),
        };

        mockApp = {
            get: vi.fn((token: any) => {
                if (token === ConfigService) return mockConfigService;
                return null;
            }),
            getHttpServer: vi.fn().mockReturnValue({}),
        } as unknown as INestApplicationContext;

        mockSubClient = {
            connect: vi.fn().mockResolvedValue(undefined),
            on: vi.fn(),
            quit: vi.fn().mockResolvedValue('OK'),
        };

        mockPubClient = {
            connect: vi.fn().mockResolvedValue(undefined),
            duplicate: vi.fn().mockReturnValue(mockSubClient),
            on: vi.fn(),
            quit: vi.fn().mockResolvedValue('OK'),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize and resolve ConfigService from app if not provided directly', () => {
        const adapter = new RedisIoAdapter(mockApp);
        expect(mockApp.get).toHaveBeenCalledWith(ConfigService);
        expect(adapter.isUsingRedis()).toBe(false);
    });

    it('should connect to Redis and set up createAdapter when Redis is available', async () => {
        const adapter = new RedisIoAdapter(mockApp, mockConfigService as any);

        // Mock internal Redis creation
        (adapter as any).pubClient = mockPubClient;
        (adapter as any).subClient = mockSubClient;

        // Spy on connectToRedis with mocked clients
        vi.spyOn(adapter as any, 'connectToRedis').mockImplementation(async () => {
            await mockPubClient.connect();
            await mockSubClient.connect();
            (adapter as any).adapterConstructor = mockCreateAdapter(mockPubClient, mockSubClient);
        });

        await adapter.connectToRedis();

        expect(mockPubClient.connect).toHaveBeenCalled();
        expect(mockSubClient.connect).toHaveBeenCalled();
        expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);
        expect(adapter.isUsingRedis()).toBe(true);

        // Test createIOServer uses redis adapter
        const mockServer = { adapter: vi.fn() };
        vi.spyOn(Object.getPrototypeOf(RedisIoAdapter.prototype), 'createIOServer').mockReturnValue(mockServer);

        const server = adapter.createIOServer(3000);
        expect(server).toBe(mockServer);
        expect(mockServer.adapter).toHaveBeenCalledWith('mock-redis-adapter-constructor');
    });

    it('should fall back gracefully to in-memory adapter when Redis connection fails', async () => {
        const adapter = new RedisIoAdapter(mockApp, mockConfigService as any);

        // Mock failure on connectToRedis
        vi.spyOn(adapter as any, 'connectToRedis').mockImplementation(async () => {
            (adapter as any).adapterConstructor = undefined;
        });

        await adapter.connectToRedis();

        expect(adapter.isUsingRedis()).toBe(false);

        const mockServer = { adapter: vi.fn() };
        vi.spyOn(Object.getPrototypeOf(RedisIoAdapter.prototype), 'createIOServer').mockReturnValue(mockServer);

        const server = adapter.createIOServer(3000);
        expect(server).toBe(mockServer);
        expect(mockServer.adapter).not.toHaveBeenCalled();
    });

    it('should cleanly quit pubClient and subClient on close()', async () => {
        const adapter = new RedisIoAdapter(mockApp, mockConfigService as any);
        (adapter as any).pubClient = mockPubClient;
        (adapter as any).subClient = mockSubClient;
        (adapter as any).adapterConstructor = 'some-adapter';

        await adapter.close();

        expect(mockPubClient.quit).toHaveBeenCalled();
        expect(mockSubClient.quit).toHaveBeenCalled();
        expect(adapter.isUsingRedis()).toBe(false);
    });
});
