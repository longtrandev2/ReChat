import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { User } from "../../users/entities/user.entity.js";
import { RedisService } from "../../../common/redis/redis.service.js";
import { getJwtSecret } from "../../../common/config/jwt-secret.js";
import {
    getAccessTokenRevocationReason,
    type RevocableTokenPayload,
} from "../../../common/auth/access-token-revocation.js";

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
            secretOrKey: getJwtSecret(configService),
            passReqToCallback: true,
        });
    }

    // Kiểm tra token đã bị thu hồi (logout, đăng xuất từ xa, reset/đổi mật khẩu) và payload hợp lệ
    async validate(reqOrPayload: any, maybePayload?: any) {
        let req: any;
        let payload: RevocableTokenPayload & { username?: string };

        if (maybePayload && reqOrPayload) {
            req = reqOrPayload;
            payload = maybePayload;
        } else {
            payload = reqOrPayload;
        }

        if (this.redisService) {
            const rawToken = req?.headers ? ExtractJwt.fromAuthHeaderAsBearerToken()(req) ?? undefined : undefined;
            const revokedReason = await getAccessTokenRevocationReason(this.redisService, payload, rawToken);
            if (revokedReason) {
                throw new UnauthorizedException(revokedReason);
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
