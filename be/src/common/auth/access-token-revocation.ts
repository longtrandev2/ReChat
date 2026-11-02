import type { RedisService } from '../redis/redis.service.js';

/**
 * Payload tối thiểu của Access Token cần cho việc kiểm tra thu hồi.
 * - jti: JWT ID, dùng cho blacklist khi logout
 * - did: Device ID, dùng cho thu hồi phiên theo thiết bị (đăng xuất từ xa)
 */
export interface RevocableTokenPayload {
    sub?: string;
    jti?: string;
    did?: string;
    iat?: number;
}

/** Mốc thời gian tối thiểu (ms) cho mọi token của user: dùng khi reset mật khẩu. */
export const userMinIssuedAtKey = (userId: string) => `auth:user_min_issued_at:${userId}`;

/** Mốc thời gian tối thiểu (ms) cho token của một thiết bị: dùng khi đăng xuất từ xa / đổi mật khẩu. */
export const deviceMinIssuedAtKey = (userId: string, deviceId: string) =>
    `auth:device_min_issued_at:${userId}:${deviceId}`;

/**
 * Mốc "now" làm tròn xuống theo giây (đơn vị ms).
 * JWT iat có độ phân giải giây, nếu dùng Date.now() thì token cấp mới ngay trong cùng giây
 * sẽ bị coi là cũ và bị từ chối nhầm.
 */
export const currentSecondInMs = () => Math.floor(Date.now() / 1000) * 1000;

const isIssuedBefore = (iat: number, minIssuedAt: string | null) =>
    Boolean(minIssuedAt) && iat * 1000 < Number(minIssuedAt);

/**
 * Kiểm tra Access Token đã bị thu hồi hay chưa. Dùng chung cho HTTP (JwtStrategy) và WebSocket (ChatGateway)
 * để token đã logout / bị đăng xuất từ xa không thể tiếp tục kết nối socket.
 * @returns lý do bị thu hồi, hoặc null nếu token còn hợp lệ
 */
export async function getAccessTokenRevocationReason(
    redisService: RedisService,
    payload: RevocableTokenPayload,
    rawToken?: string,
): Promise<string | null> {
    if (payload?.jti && (await redisService.isTokenBlacklisted(payload.jti))) {
        return 'Phiên đăng nhập đã bị thu hồi hoặc đã đăng xuất';
    }

    if (rawToken && (await redisService.isTokenBlacklisted(rawToken))) {
        return 'Phiên đăng nhập đã bị thu hồi hoặc đã đăng xuất';
    }

    if (payload?.iat && payload?.sub) {
        const userMinIat = await redisService.get(userMinIssuedAtKey(payload.sub));
        if (isIssuedBefore(payload.iat, userMinIat)) {
            return 'Phiên đăng nhập đã bị hủy từ xa';
        }

        if (payload.did) {
            const deviceMinIat = await redisService.get(deviceMinIssuedAtKey(payload.sub, payload.did));
            if (isIssuedBefore(payload.iat, deviceMinIat)) {
                return 'Phiên đăng nhập trên thiết bị này đã bị đăng xuất từ xa';
            }
        }
    }

    return null;
}
