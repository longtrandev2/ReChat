import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { User } from "../../users/entities/user.entity.js";



@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET!,
        });
    }
    // Hàm phải implenmet khi extend PassportStrategy -> kiểm tra payload có hợp lệ hay không
    async validate(payload: { sub: string, username: string }) {

        const user = await this.userRepository.findOne({
            where: { id: payload.sub }
        })
        if (!user)
            throw new UnauthorizedException('User không tồn tại')

        //Rest Parameter: bỏ password, phần còn lại là result
        const { password, ...result } = user;

        return result;
    }

}