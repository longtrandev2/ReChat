import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

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
