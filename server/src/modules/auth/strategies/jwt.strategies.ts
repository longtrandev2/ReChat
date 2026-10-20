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
        let payload: { sub: string; username: string };

        if (maybePayload && reqOrPayload) {
            req = reqOrPayload;
            payload = maybePayload;
        } else {
            payload = reqOrPayload;
        }

        if (req && this.redisService) {
            const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
            if (token && (await this.redisService.isTokenBlacklisted(token))) {
                throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi hoặc đã đăng xuất');
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