const DEFAULT_CLIENT_URL = 'http://localhost:5173';

/**
 * Danh sách origin được phép gọi API/WebSocket kèm credentials (cookie).
 * Đọc từ CLIENT_URL (hỗ trợ nhiều origin phân tách bằng dấu phẩy).
 * Đọc lazy tại runtime vì decorator @WebSocketGateway được đánh giá trước khi ConfigModule nạp .env.
 */
export function getAllowedOrigins(): string[] {
    return parseOrigins(process.env.CLIENT_URL);
}

/** Tách CLIENT_URL (có thể nhiều origin, phân tách bằng dấu phẩy) thành danh sách origin chuẩn hóa. */
export function parseOrigins(raw?: string | null): string[] {
    const origins = (raw || DEFAULT_CLIENT_URL)
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    return origins.length > 0 ? origins : [DEFAULT_CLIENT_URL];
}

/** Origin chính của web client (origin đầu tiên): dùng để dựng link trong email (đặt lại mật khẩu...). */
export function getPrimaryClientUrl(raw?: string | null): string {
    return parseOrigins(raw)[0];
}

/**
 * Callback origin cho cả Express CORS và Socket.IO CORS.
 * - Không có Origin header (curl, server-to-server, Swagger cùng origin): cho phép.
 * - Có Origin: chỉ cho phép khi nằm trong whitelist, tránh phản chiếu mọi origin kèm credentials.
 */
export function corsOriginCallback(
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
): void {
    if (!origin) {
        callback(null, true);
        return;
    }
    callback(null, getAllowedOrigins().includes(origin.replace(/\/+$/, '')));
}
