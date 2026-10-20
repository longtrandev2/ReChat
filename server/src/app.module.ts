import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './modules/users/user.module.js';
import { ConversationsModule } from './modules/conversations/conversations.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { FriendsModule } from './modules/friends/friends.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { MailModule } from './common/mail/mail.module.js';
import { ThrottlerStorageRedisService } from './common/redis/throttler-storage-redis.service.js';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware.js';
export const { ObserveModule, ObserveInstrument } = createObserveModule();

import { AppThrottlerGuard } from './common/guards/app-throttler.guard.js';

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: Number(configService.get<number>('REDIS_PORT')) || 6379,
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    MailModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [ThrottlerStorageRedisService],
      useFactory: (storage: ThrottlerStorageRedisService) => ({
        throttlers: [
          { name: 'default', ttl: 60000, limit: 100 },
          { name: 'auth', ttl: 60000, limit: 5 },
        ],
        storage,
      }),
    }),
    UsersModule,
    ConversationsModule,
    AuthModule,
    FriendsModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      username: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      autoLoadEntities: true,
      synchronize: true,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}

