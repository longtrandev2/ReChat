import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Logger, INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
    protected override readonly logger = new Logger(RedisIoAdapter.name);
    private adapterConstructor?: ReturnType<typeof createAdapter>;
    private pubClient?: Redis;
    private subClient?: Redis;
    private configService?: ConfigService;

    constructor(
        appOrHttpServer: INestApplicationContext,
        configService?: ConfigService,
    ) {
        super(appOrHttpServer);
        if (configService) {
            this.configService = configService;
        } else {
            try {
                this.configService = appOrHttpServer.get(ConfigService);
            } catch {
                // ConfigService might not be available in isolated environments
            }
        }
    }

    async connectToRedis(): Promise<void> {
        const host = this.configService?.get<string>('REDIS_HOST') || 'localhost';
        const port = Number(this.configService?.get<number>('REDIS_PORT')) || 6379;
        const password = this.configService?.get<string>('REDIS_PASSWORD') || undefined;

        try {
            this.pubClient = new Redis({
                host,
                port,
                password,
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                connectTimeout: 5000,
            });

            this.pubClient.on('error', (err) => {
                this.logger.warn(`Redis PubClient error: ${err.message}`);
            });

            this.subClient = this.pubClient.duplicate();

            this.subClient.on('error', (err) => {
                this.logger.warn(`Redis SubClient error: ${err.message}`);
            });

            await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

            this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
            this.logger.log(`RedisIoAdapter connected to Redis Pub/Sub at ${host}:${port}`);
        } catch (error: any) {
            this.logger.warn(
                `Failed to connect to Redis for WebSocket adapter: ${error.message}. Falling back to in-memory adapter.`,
            );
            await this.close();
        }
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
            this.logger.log('WebSocket Server attached to Redis Pub/Sub Adapter');
        } else {
            this.logger.log('WebSocket Server running with default in-memory adapter');
        }
        return server;
    }

    async close(): Promise<void> {
        try {
            if (this.pubClient) {
                await this.pubClient.quit();
                this.pubClient = undefined;
            }
            if (this.subClient) {
                await this.subClient.quit();
                this.subClient = undefined;
            }
            this.adapterConstructor = undefined;
        } catch (error: any) {
            this.logger.warn(`Error disconnecting RedisIoAdapter clients: ${error.message}`);
        }
    }

    isUsingRedis(): boolean {
        return !!this.adapterConstructor;
    }
}
