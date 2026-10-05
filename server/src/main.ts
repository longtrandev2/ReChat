import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api/v1')


  // Bật ValidationPipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động lọc các field thừa không khai báo trong DTO
      transform: true, // Tự động ép kiểu dữ liệu
    })
  );



  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
