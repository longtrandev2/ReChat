const DEFAULT_CLIENT_URL = 'http://localhost:5173';

/**
 * Danh sách origin được phép gọi API/WebSocket kèm credentials (cookie).
 * Đọc từ CLIENT_URL (hỗ trợ nhiều origin phân tách bằng dấu phẩy).
 * Đọc lazy tại runtime vì decorator @WebSocketGateway được đánh giá trước khi ConfigModule nạp .env.
 */
export function getAllowedOrigins(): string[] {
    const raw = process.env.CLIENT_URL || DEFAULT_CLIENT_URL;
    return raw
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
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
