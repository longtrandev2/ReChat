import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/user.module.js';
import { MailModule } from '../../common/mail/mail.module.js';
import { AuthService } from './auth.service.js';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategies.js';
import { AuthController } from './auth.controller.js';
import { TokenManagerService } from './token-manager.service.js';
import { getJwtSecret } from '../../common/config/jwt-secret.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './constants/auth-cookie.constants.js';

@Module({
    imports: [
        UsersModule, // Import UsersModule để dùng Repository<User>
        PassportModule,
        MailModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: getJwtSecret(configService),
                // Mặc định khớp Access Token ngắn hạn 15 phút, không cấp token dài hạn ngoài luồng TokenManager
                signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
            }),
        }),
    ],
    providers: [AuthService, JwtStrategy, TokenManagerService],
    controllers: [AuthController],
    exports: [AuthService, JwtModule, TokenManagerService]
})
export class AuthModule { }

