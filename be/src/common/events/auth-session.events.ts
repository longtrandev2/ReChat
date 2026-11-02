/**
 * Domain event: phiên đăng nhập bị thu hồi (BR-24, BR-27).
 * ChatGateway lắng nghe để ngắt ngay các kết nối WebSocket đang mở của thiết bị bị thu hồi,
 * tránh việc thiết bị đó tiếp tục nhận tin nhắn / presence realtime.
 */
export const AUTH_SESSIONS_REVOKED = 'auth.sessions_revoked';

export type RevokedSessionScope =
    /** Chỉ các thiết bị được liệt kê (đăng xuất, đăng xuất từ xa) */
    | { type: 'devices'; deviceIds: string[] }
    /** Mọi thiết bị trừ thiết bị hiện tại (đổi mật khẩu) */
    | { type: 'allExcept'; deviceId: string }
    /** Mọi thiết bị (đặt lại mật khẩu) */
    | { type: 'all' };

export class AuthSessionsRevokedEvent {
    constructor(
        public readonly userId: string,
        public readonly scope: RevokedSessionScope,
    ) { }
}
