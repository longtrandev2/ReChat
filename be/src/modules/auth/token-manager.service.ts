import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { RedisService } from '../../common/redis/redis.service.js';
import {
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_GRACE_PERIOD_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS,
} from './constants/auth-cookie.constants.js';
import { getJwtSecret } from '../../common/config/jwt-secret.js';
import {
    deviceMinIssuedAtKey,
    isIssuedBeforeMarker,
    userMinIssuedAtKey,
} from '../../common/auth/access-token-revocation.js';

/** deviceId -> familyId: cho phép thu hồi đúng chuỗi refresh token của một thiết bị */
const deviceFamilyKey = (userId: string, deviceId: string) => `auth:device_family:${userId}:${deviceId}`;
/** Tập deviceId từng được cấp refresh token (độc lập với danh sách session hiển thị trên UI) */
const userTokenDevicesKey = (userId: string) => `auth:user_token_devices:${userId}`;
/** deviceId dùng chung khi không xác định được thiết bị: không được hủy chéo family của nhau */
const SHARED_FALLBACK_DEVICE_ID = 'default-device';

export interface TokenUserPayload {
    id: string;
    username: string;
    role?: string;
}

export interface RefreshTokenMetadata {
    tokenId: string;
    familyId: string;
    userId: string;
    username: string;
    role?: string;
    deviceId: string;
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
}

export interface GeneratedTokenPair {
    accessToken: string;
    refreshToken: string;
    familyId: string;
    deviceId: string;
    jti: string;
    userId: string;
}

@Injectable()
export class TokenManagerService {
    private readonly logger = new Logger(TokenManagerService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) { }

    /**
     * Băm secret của Refresh Token bằng SHA-256 (Chuẩn bảo vệ chống rò rỉ cơ sở dữ liệu/Redis)
     */
    private hashSecret(secret: string): string {
        return createHash('sha256').update(secret).digest('hex');
    }

    /**
     * Tách raw refresh token dạng `${tokenId}.${secret}` thành tokenId và secret
     */
    parseRawRefreshToken(rawToken?: string): { tokenId: string; secret: string } | null {
        if (!rawToken || typeof rawToken !== 'string') {
            return null;
        }

        const parts = rawToken.split('.');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            return null;
        }

        return { tokenId: parts[0], secret: parts[1] };
    }

    /**
     * Cấp phát cặp Access Token (In-Memory 15m) và Refresh Token (HttpOnly 30d)
     * Kèm theo gán chuỗi Token Family để theo dõi phát hiện hành vi trộm cắp token
     */
    async generateTokenPair(
        user: TokenUserPayload,
        deviceId: string = 'default-device',
        existingFamilyId?: string,
    ): Promise<GeneratedTokenPair> {
        const jti = randomUUID();
        const familyId = existingFamilyId || randomUUID();
        const tokenId = randomUUID();
        const secret = randomBytes(32).toString('base64url');
        const tokenHash = this.hashSecret(secret);
        const now = Date.now();
        const expiresAt = now + REFRESH_TOKEN_TTL_SECONDS * 1000;

        // 1. Ký Access Token ngắn hạn (15 phút) kèm JWT ID (jti) phục vụ blacklist khi logout
        const jwtSecret = getJwtSecret(this.configService);
        const accessToken = await this.jwtService.signAsync(
            {
                sub: user.id,
                username: user.username,
                role: user.role,
                jti,
                did: deviceId, // Device ID: phục vụ đăng xuất từ xa theo từng thiết bị
                iatMs: now, // Thời điểm cấp theo ms: so sánh chính xác với mốc thu hồi (iat chỉ có độ phân giải giây)
            },
            {
                secret: jwtSecret,
                expiresIn: ACCESS_TOKEN_TTL_SECONDS,
            },
        );

        // 2. Định dạng Raw Refresh Token gửi về trình duyệt qua HttpOnly Cookie: `${tokenId}.${secret}`
        const rawRefreshToken = `${tokenId}.${secret}`;

        // 3. Metadata lưu trữ trong Redis (Chỉ lưu SHA-256 Hash, không bao giờ lưu plaintext secret)
        const metadata: RefreshTokenMetadata = {
            tokenId,
            familyId,
            userId: user.id,
            username: user.username,
            role: user.role,
            deviceId,
            tokenHash,
            createdAt: now,
            expiresAt,
        };

        const tokenKey = `auth:refresh:${tokenId}`;
        const familyKey = `auth:family:${familyId}`;
        const userSessionsKey = `auth:user_sessions:${user.id}`;

        await this.redisService.set(tokenKey, JSON.stringify(metadata), REFRESH_TOKEN_TTL_SECONDS);
        await this.redisService.sadd(familyKey, tokenId);
        await this.redisService.expire(familyKey, REFRESH_TOKEN_TTL_SECONDS);
        await this.redisService.sadd(userSessionsKey, deviceId);
        await this.bindFamilyToDevice(user.id, deviceId, familyId, Boolean(existingFamilyId));

        return {
            accessToken,
            refreshToken: rawRefreshToken,
            familyId,
            deviceId,
            jti,
            userId: user.id,
        };
    }

    /**
     * Xác thực tính hợp lệ của Refresh Token: Kiểm tra Redis và so khớp Hash an toàn chống Timing Attack
     */
    async verifyRefreshTokenRecord(
        tokenId: string,
        secret: string,
    ): Promise<RefreshTokenMetadata | null> {
        const tokenKey = `auth:refresh:${tokenId}`;
        const rawData = await this.redisService.get(tokenKey);
        if (!rawData) {
            return null;
        }

        try {
            const metadata = JSON.parse(rawData) as RefreshTokenMetadata;
            const inputHashBuffer = Buffer.from(this.hashSecret(secret), 'hex');
            const targetHashBuffer = Buffer.from(metadata.tokenHash, 'hex');

            if (inputHashBuffer.length !== targetHashBuffer.length) {
                return null;
            }

            // Dùng timingSafeEqual ngăn chặn tấn công timing attack
            const isValid = timingSafeEqual(inputHashBuffer, targetHashBuffer);
            if (!isValid) {
                return null;
            }

            return metadata;
        } catch (error) {
            this.logger.error(`Error parsing refresh token record for key ${tokenKey}: ${error}`);
            return null;
        }
    }

    /**
     * Xoay vòng Refresh Token (RTR) với 30s Server Grace Period và Phát hiện Trộm Token (Reuse Detection)
     */
    async rotateRefreshToken(
        rawRefreshToken?: string,
        deviceId?: string,
    ): Promise<GeneratedTokenPair> {
        const parsed = this.parseRawRefreshToken(rawRefreshToken);
        if (!parsed) {
            throw new UnauthorizedException('Refresh token không hợp lệ hoặc thiếu');
        }

        const { tokenId, secret } = parsed;

        // 1. Kiểm tra 30s Grace Period (Xử lý Race Condition khi mở nhiều tab cùng lúc)
        const graceKey = `auth:grace:${tokenId}`;
        const graceData = await this.redisService.get(graceKey);
        if (graceData) {
            try {
                const cachedPair = JSON.parse(graceData) as GeneratedTokenPair;
                // Khóa ràng buộc thiết bị trong thời gian ân hạn: Ngăn chặn thiết bị khác lợi dụng token vừa xoay
                if (
                    deviceId &&
                    cachedPair.deviceId &&
                    cachedPair.deviceId !== 'default-device' &&
                    deviceId !== cachedPair.deviceId
                ) {
                    this.logger.warn(
                        `[SECURITY WARNING] Grace period device mismatch: ${deviceId} vs ${cachedPair.deviceId} (User: ${cachedPair.userId})`,
                    );
                    throw new UnauthorizedException('Phiên đăng nhập không thuộc thiết bị này');
                }
                this.logger.debug(`[GracePeriod] Trả về token mới từ ân hạn cho tab song song: ${tokenId}`);
                return cachedPair;
            } catch (e) {
                if (e instanceof UnauthorizedException) {
                    throw e;
                }
                this.logger.warn(`Lỗi parse grace data cho token ${tokenId}: ${e}`);
            }
        }

        // 2. Xác thực token record trong Redis
        const record = await this.verifyRefreshTokenRecord(tokenId, secret);
        if (!record) {
            // Kiểm tra xem token này có phải là token cũ đã từng được xoay vòng nhưng quá hạn 30s không
            const invalidatedKey = `auth:invalidated:${tokenId}`;
            const stolenFamilyId = await this.redisService.get(invalidatedKey);
            if (stolenFamilyId) {
                // PHÁT HIỆN HÀNH VI TÁI SỬ DỤNG TOKEN (TOKEN THEFT DETECTED - OWASP 2025)
                this.logger.error(`[SECURITY ALERT] Phát hiện token cũ bị tái sử dụng! Family: ${stolenFamilyId}, Token: ${tokenId}`);
                await this.revokeFamily(stolenFamilyId);
                throw new ForbiddenException({
                    errorCode: 'SECURITY_TOKEN_THEFT_DETECTED',
                    message: 'Phát hiện hành vi sử dụng lại token trái phép. Toàn bộ phiên đăng nhập của thiết bị này đã bị hủy để bảo vệ tài khoản.',
                });
            }

            throw new UnauthorizedException('Phiên đăng nhập đã hết hạn hoặc không tồn tại');
        }

        // 3. Khóa ràng buộc thiết bị (Device Binding Enforcement):
        // Nếu token được phát hành cho một thiết bị cụ thể khác 'default-device',
        // nhưng request refresh lại gửi kèm một deviceId khác -> Chặn nguy cơ đánh cắp Cookie đem sang thiết bị khác!
        if (
            deviceId &&
            record.deviceId &&
            record.deviceId !== 'default-device' &&
            deviceId !== record.deviceId
        ) {
            this.logger.warn(
                `[SECURITY WARNING] Phát hiện Refresh Token của thiết bị '${record.deviceId}' được gửi từ thiết bị khác: '${deviceId}' (User: ${record.userId})`,
            );
            throw new UnauthorizedException('Phiên đăng nhập không thuộc thiết bị này');
        }

        // 3b. Family đã bị thu hồi (reset/đổi mật khẩu, đăng xuất từ xa) hoặc bị thay thế bởi lần đăng nhập mới
        await this.assertFamilyStillActive(record);

        // 4. Tạo cặp token mới kế thừa Token Family
        const effectiveDeviceId = deviceId || record.deviceId;
        const newPair = await this.generateTokenPair(
            {
                id: record.userId,
                username: record.username,
                role: record.role,
            },
            effectiveDeviceId,
            record.familyId,
        );

        // 4b. Kiểm tra lại sau khi ghi token mới: chặn race "refresh song song với thu hồi" làm sống lại family
        await this.assertFamilyStillActive(record);

        // 4. Vô hiệu hóa token cũ:
        // - Xóa key active refresh token
        await this.redisService.del(`auth:refresh:${tokenId}`);
        await this.redisService.srem(`auth:family:${record.familyId}`, tokenId);

        // - Lưu token mới vào Grace Period với TTL 30 giây (cho các tab khác gửi trễ)
        await this.redisService.set(graceKey, JSON.stringify(newPair), REFRESH_TOKEN_GRACE_PERIOD_SECONDS);

        // - Lưu vào Invalidated Tracker với TTL 30 ngày (để phát hiện Hacker sau 30s)
        await this.redisService.set(`auth:invalidated:${tokenId}`, record.familyId, REFRESH_TOKEN_TTL_SECONDS);

        return newPair;
    }

    /**
     * Thu hồi một Refresh Token cụ thể
     */
    async revokeToken(tokenId: string, familyId?: string): Promise<void> {
        const tokenKey = `auth:refresh:${tokenId}`;
        await this.redisService.del(tokenKey);

        if (familyId) {
            await this.redisService.srem(`auth:family:${familyId}`, tokenId);
        }
    }

    /**
     * Gắn Token Family với thiết bị. Khi thiết bị đăng nhập lại (family mới), family cũ của chính thiết bị đó
     * bị hủy để không còn refresh token "mồ côi" sống tiếp 30 ngày ngoài tầm kiểm soát.
     */
    private async bindFamilyToDevice(
        userId: string,
        deviceId: string,
        familyId: string,
        isRotation: boolean,
    ): Promise<void> {
        const key = deviceFamilyKey(userId, deviceId);
        const boundFamilyId = await this.redisService.get(key);

        if (isRotation) {
            // Xoay vòng không được ghi đè family khác (vd: thiết bị vừa đăng nhập lại song song) -> family cũ
            // sẽ bị assertFamilyStillActive() từ chối; chỉ gắn khi chưa có (token cấp trước khi có chỉ mục) hoặc trùng
            if (boundFamilyId && boundFamilyId !== familyId) {
                return;
            }
        } else if (deviceId !== SHARED_FALLBACK_DEVICE_ID && boundFamilyId && boundFamilyId !== familyId) {
            await this.revokeFamily(boundFamilyId);
        }

        await this.redisService.set(key, familyId, REFRESH_TOKEN_TTL_SECONDS);
        await this.redisService.sadd(userTokenDevicesKey(userId), deviceId);
        await this.redisService.expire(userTokenDevicesKey(userId), REFRESH_TOKEN_TTL_SECONDS);
    }

    /**
     * Đăng xuất hoàn toàn một thiết bị (BR-27):
     * - Hủy Token Family của thiết bị => không thể refresh nữa
     * - Ghi mốc device_min_issued_at => Access Token (HTTP & WebSocket) đang dùng bị từ chối ngay
     */
    async revokeDevice(userId: string, deviceId: string): Promise<void> {
        const key = deviceFamilyKey(userId, deviceId);
        const familyId = await this.redisService.get(key);
        if (familyId) {
            await this.revokeFamily(familyId);
        }

        await this.redisService.del(key);
        await this.redisService.srem(userTokenDevicesKey(userId), deviceId);
        // Mốc theo ms, sống bằng Refresh Token (30 ngày) vì /auth/refresh cũng đối chiếu mốc này
        await this.redisService.set(
            deviceMinIssuedAtKey(userId, deviceId),
            String(Date.now()),
            REFRESH_TOKEN_TTL_SECONDS,
        );
    }

    /**
     * Đăng xuất mọi thiết bị của user, tùy chọn giữ lại thiết bị hiện tại (dùng khi đổi / đặt lại mật khẩu).
     * @returns danh sách deviceId đã bị thu hồi
     */
    async revokeAllDevices(userId: string, exceptDeviceId?: string): Promise<string[]> {
        // Gộp cả tập thiết bị cũ (auth:user_sessions) để không bỏ sót token cấp trước khi có chỉ mục thiết bị
        const [indexedDevices, legacyDevices] = await Promise.all([
            this.redisService.smembers(userTokenDevicesKey(userId)),
            this.redisService.smembers(`auth:user_sessions:${userId}`),
        ]);
        const targets = [...new Set([...indexedDevices, ...legacyDevices])].filter((id) => id !== exceptDeviceId);

        for (const deviceId of targets) {
            await this.revokeDevice(userId, deviceId);
        }

        return targets;
    }

    /**
     * Từ chối refresh nếu family đã bị thu hồi gián tiếp:
     * - Token được cấp trước mốc thu hồi của user (reset mật khẩu) hoặc của thiết bị (đăng xuất / đổi mật khẩu)
     * - Thiết bị đã gắn sang family khác (đăng nhập lại) => family này đã bị thay thế
     * Khi vi phạm: hủy toàn bộ family (kể cả token vừa cấp trong race) và trả 401.
     */
    private async assertFamilyStillActive(record: RefreshTokenMetadata): Promise<void> {
        const [userMarker, deviceMarker, boundFamilyId] = await Promise.all([
            this.redisService.get(userMinIssuedAtKey(record.userId)),
            this.redisService.get(deviceMinIssuedAtKey(record.userId, record.deviceId)),
            this.redisService.get(deviceFamilyKey(record.userId, record.deviceId)),
        ]);

        const isRevokedByMarker =
            isIssuedBeforeMarker(record.createdAt, userMarker) || isIssuedBeforeMarker(record.createdAt, deviceMarker);
        const isSuperseded =
            record.deviceId !== SHARED_FALLBACK_DEVICE_ID && Boolean(boundFamilyId) && boundFamilyId !== record.familyId;

        if (isRevokedByMarker || isSuperseded) {
            this.logger.warn(
                `[Revocation] Từ chối refresh family ${record.familyId} của thiết bị ${record.deviceId} (User: ${record.userId})`,
            );
            await this.revokeFamily(record.familyId);
            throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
        }
    }

    /**
     * Hủy diệt toàn bộ Token Family (Dùng khi phát hiện hành vi Token Theft / Hacker tái sử dụng token lậu)
     */
    async revokeFamily(familyId: string): Promise<void> {
        const familyKey = `auth:family:${familyId}`;
        const tokenIds = await this.redisService.smembers(familyKey);

        if (tokenIds.length > 0) {
            const keysToDelete = tokenIds.map((id) => `auth:refresh:${id}`);
            await this.redisService.del(...keysToDelete);
        }

        await this.redisService.del(familyKey);
    }
}
