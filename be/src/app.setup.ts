import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { corsOriginCallback } from './common/config/cors-origins.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

/**
 * Cấu hình HTTP pipeline dùng chung cho production (main.ts) và e2e test,
 * đảm bảo e2e kiểm thử đúng hành vi thật: prefix /api/v1, cookie HttpOnly, envelope, exception filter.
 */
export function configureApp(app: INestApplication): void {
    // HTTP Security Headers (Swagger UI cần inline CSS/JS nên tắt CSP)
    app.use(
        helmet({
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: false,
        }),
    );

    // Parse Cookie cho xác thực HttpOnly Refresh Token
    app.use(cookieParser());

    // CORS whitelist theo CLIENT_URL: không phản chiếu mọi origin khi bật credentials (cookie)
    app.enableCors({
        origin: corsOriginCallback,
        credentials: true,
    });

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, // Lọc field thừa không khai báo trong DTO
            transform: true, // Tự động ép kiểu dữ liệu
        }),
    );

    // Response Envelope và Exception Filter toàn cục (Envelope Pattern)
    // ClassSerializerInterceptor áp dụng @Exclude() trên entity (vd: email/2FA/password của User) trước khi bọc envelope
    app.useGlobalInterceptors(new TransformInterceptor(), new ClassSerializerInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new AllExceptionsFilter());
}
