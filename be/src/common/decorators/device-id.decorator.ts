import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';

/**
 * Hàm trích xuất Device ID theo chuẩn ưu tiên:
 * 1. Ưu tiên đọc Header X-Device-Id do client gửi lên (UUID cố định trong LocalStorage).
 * 2. Fallback: Nếu không có, tạo fingerprint băm ngắn 16 ký tự từ User-Agent.
 * 3. Fallback cuối cùng: 'default-device'.
 */
export function extractDeviceId(req?: Request): string {
    if (!req || !req.headers) {
        return 'default-device';
    }

    const headerDeviceId = req.headers['x-device-id'];
    if (typeof headerDeviceId === 'string' && headerDeviceId.trim()) {
        return headerDeviceId.trim();
    }

    const userAgent = req.headers['user-agent'];
    if (typeof userAgent === 'string' && userAgent.trim()) {
        const hash = createHash('sha256').update(userAgent.trim()).digest('hex').slice(0, 16);
        return `ua-${hash}`;
    }

    return 'default-device';
}

/**
 * Parameter Decorator trong NestJS Controller: @DeviceId() deviceId: string
 */
export const DeviceId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest<Request>();
        return extractDeviceId(request);
    },
);
