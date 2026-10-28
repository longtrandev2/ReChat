import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { RedisService } from '../../common/redis/redis.service.js';
import {
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS,
} from './constants/auth-cookie.constants.js';

export interface TokenUserPayload {
    id: string;
    username: string;
    role?: string;
}

export interface RefreshTokenMetadata {
    tokenId: string;
    familyId: string;
    userId: string;
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
        const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'secretKeyChatApp123';
        const accessToken = await this.jwtService.signAsync(
            {
                sub: user.id,
                username: user.username,
                role: user.role,
                jti,
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
            deviceId,
            tokenHash,
            createdAt: now,
            expiresAt,
        };

        const tokenKey = `auth:refresh:${user.id}:${tokenId}`;
        const familyKey = `auth:family:${familyId}`;
        const userSessionsKey = `auth:user_sessions:${user.id}`;

        await this.redisService.set(tokenKey, JSON.stringify(metadata), REFRESH_TOKEN_TTL_SECONDS);
        await this.redisService.sadd(familyKey, tokenId);
        await this.redisService.expire(familyKey, REFRESH_TOKEN_TTL_SECONDS);
        await this.redisService.sadd(userSessionsKey, deviceId);

        return {
            accessToken,
            refreshToken: rawRefreshToken,
            familyId,
            deviceId,
            jti,
        };
    }

    /**
     * Xác thực tính hợp lệ của Refresh Token: Kiểm tra Redis và so khớp Hash an toàn chống Timing Attack
     */
    async verifyRefreshTokenRecord(
        userId: string,
        tokenId: string,
        secret: string,
    ): Promise<RefreshTokenMetadata | null> {
        const tokenKey = `auth:refresh:${userId}:${tokenId}`;
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
     * Thu hồi một Refresh Token cụ thể
     */
    async revokeToken(userId: string, tokenId: string, familyId?: string): Promise<void> {
        const tokenKey = `auth:refresh:${userId}:${tokenId}`;
        await this.redisService.del(tokenKey);

        if (familyId) {
            await this.redisService.srem(`auth:family:${familyId}`, tokenId);
        }
    }

    /**
     * Hủy diệt toàn bộ Token Family (Dùng khi phát hiện hành vi Token Theft / Hacker tái sử dụng token lậu)
     */
    async revokeFamily(familyId: string, userId?: string): Promise<void> {
        const familyKey = `auth:family:${familyId}`;
        const tokenIds = await this.redisService.smembers(familyKey);

        if (tokenIds.length > 0 && userId) {
            const keysToDelete = tokenIds.map((id) => `auth:refresh:${userId}:${id}`);
            await this.redisService.del(...keysToDelete);
        }

        await this.redisService.del(familyKey);
    }
}
