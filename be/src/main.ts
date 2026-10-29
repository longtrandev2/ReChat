import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RedisIoAdapter } from './common/adapters/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Cấu hình HTTP Security Headers với Helmet
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false, // Cho phép Swagger UI tải inline CSS/JS
    }),
  );

  // Parse Cookie cho xác thực HttpOnly Refresh Token an toàn (OWASP 2025)
  app.use(cookieParser());

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  // Bật ValidationPipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động lọc các field thừa không khai báo trong DTO
      transform: true, // Tự động ép kiểu dữ liệu
    })
  );

  // Đăng ký Response Envelope và Exception Filter toàn cục (Envelope Pattern)
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Cấu hình WebSocket Redis Adapter (Horizontal Scaling đa pods)
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('ReChat API')
    .setDescription('Tài liệu API hệ thống tin nhắn thời gian thực ReChat')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Nhập access token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
