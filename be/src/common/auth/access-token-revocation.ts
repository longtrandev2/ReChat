import type { RedisService } from '../redis/redis.service.js';

/**
 * Payload tối thiểu của Access Token cần cho việc kiểm tra thu hồi.
 * - jti: JWT ID, dùng cho blacklist khi logout
 * - did: Device ID, dùng cho thu hồi phiên theo thiết bị (đăng xuất từ xa)
 * - iatMs: thời điểm cấp token theo mili-giây (iat chuẩn JWT chỉ có độ phân giải giây)
 */
export interface RevocableTokenPayload {
    sub?: string;
    jti?: string;
    did?: string;
    iat?: number;
    iatMs?: number;
}

/** Mốc thời gian tối thiểu (ms) cho mọi token của user: dùng khi reset mật khẩu. */
export const userMinIssuedAtKey = (userId: string) => `auth:user_min_issued_at:${userId}`;

/** Mốc thời gian tối thiểu (ms) cho token của một thiết bị: dùng khi đăng xuất / đăng xuất từ xa / đổi mật khẩu. */
export const deviceMinIssuedAtKey = (userId: string, deviceId: string) =>
    `auth:device_min_issued_at:${userId}:${deviceId}`;

/**
 * Thời điểm `issuedAtMs` có trước mốc thu hồi `marker` (ms) hay không.
 * Dùng cho cả Refresh Token (metadata.createdAt) và Access Token (claim iatMs).
 */
export const isIssuedBeforeMarker = (issuedAtMs: number, marker: string | null): boolean =>
    Boolean(marker) && issuedAtMs < Number(marker);

/**
 * So sánh Access Token với mốc thu hồi:
 * - Token mới có iatMs: so sánh chính xác theo mili-giây (token cấp cùng giây trước khi thu hồi vẫn bị chặn)
 * - Token cũ chỉ có iat (giây): làm tròn mốc xuống giây để không chặn nhầm token cấp ngay sau thu hồi
 */
function isAccessTokenIssuedBefore(payload: RevocableTokenPayload, marker: string | null): boolean {
    if (!marker) return false;
    if (typeof payload.iatMs === 'number') {
        return isIssuedBeforeMarker(payload.iatMs, marker);
    }
    if (typeof payload.iat === 'number') {
        return payload.iat * 1000 < Math.floor(Number(marker) / 1000) * 1000;
    }
    return false;
}

/**
 * Kiểm tra Access Token đã bị thu hồi hay chưa. Dùng chung cho HTTP (JwtStrategy) và WebSocket (ChatGateway)
 * để token đã logout / bị đăng xuất từ xa không thể tiếp tục gọi API hay kết nối socket.
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

    if (payload?.sub && (payload.iat || payload.iatMs)) {
        const userMinIat = await redisService.get(userMinIssuedAtKey(payload.sub));
        if (isAccessTokenIssuedBefore(payload, userMinIat)) {
            return 'Phiên đăng nhập đã bị hủy từ xa';
        }

        if (payload.did) {
            const deviceMinIat = await redisService.get(deviceMinIssuedAtKey(payload.sub, payload.did));
            if (isAccessTokenIssuedBefore(payload, deviceMinIat)) {
                return 'Phiên đăng nhập trên thiết bị này đã bị đăng xuất từ xa';
            }
        }
    }

    return null;
}
