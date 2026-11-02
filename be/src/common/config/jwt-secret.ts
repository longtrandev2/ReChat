import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const DEV_FALLBACK_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';
let hasWarned = false;

/**
 * Lấy JWT secret dùng chung cho JwtModule, JwtStrategy và TokenManagerService.
 * - Production: bắt buộc cấu hình JWT_SECRET, thiếu sẽ throw để app không khởi động
 *   với secret mặc định công khai (ai cũng có thể giả mạo token).
 * - Development/Test: cho phép fallback nhưng log cảnh báo một lần.
 */
export function getJwtSecret(configService: ConfigService): string {
    const secret = configService.get<string>('JWT_SECRET');
    if (secret && secret.trim()) {
        return secret;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET chưa được cấu hình. Không thể khởi động ở môi trường production.');
    }

    if (!hasWarned) {
        hasWarned = true;
        new Logger('JwtSecret').warn('JWT_SECRET chưa được cấu hình, đang dùng secret mặc định chỉ dành cho development.');
    }
    return DEV_FALLBACK_JWT_SECRET;
}
