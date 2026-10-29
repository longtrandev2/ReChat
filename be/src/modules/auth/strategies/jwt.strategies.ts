import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { User } from "../../users/entities/user.entity.js";
import { RedisService } from "../../../common/redis/redis.service.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'secretKeyChatApp123',
            passReqToCallback: true,
        });
    }

    // Kiểm tra token blacklist và payload hợp lệ
    async validate(reqOrPayload: any, maybePayload?: any) {
        let req: any;
        let payload: { sub: string; username: string; jti?: string; iat?: number };

        if (maybePayload && reqOrPayload) {
            req = reqOrPayload;
            payload = maybePayload;
        } else {
            payload = reqOrPayload;
        }

        if (this.redisService) {
            // 1. Kiểm tra JTI blacklist (Vô hiệu hóa Access Token cụ thể khi logout)
            if (payload?.jti && (await this.redisService.isTokenBlacklisted(payload.jti))) {
                throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc đã đăng xuất');
            }

            // 2. Kiểm tra token string blacklist (Hỗ trợ tương thích ngược token cũ)
            if (req && req.headers) {
                const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
                if (token && (await this.redisService.isTokenBlacklisted(token))) {
                    throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc đã đăng xuất');
                }
            }

            // 3. Kiểm tra mốc thời gian tối thiểu (Remote Logout / Password Reset)
            if (payload?.iat && payload?.sub) {
                const minIat = await this.redisService.get(`auth:user_min_issued_at:${payload.sub}`);
                if (minIat && payload.iat * 1000 < Number(minIat)) {
                    throw new UnauthorizedException('Phiên đăng nhập đã bị hủy từ xa');
                }
            }
        }

        const user = await this.userRepository.findOne({
            where: { id: payload.sub },
        });

        if (!user) {
            throw new UnauthorizedException('User không tồn tại');
        }

        const { password: _password, ...result } = user;
        return result;
    }
}