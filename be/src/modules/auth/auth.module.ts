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

@Module({
    imports: [
        UsersModule, // Import UsersModule để dùng Repository<User>
        PassportModule,
        MailModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'secretKeyChatApp123',
                signOptions: { expiresIn: '7d' },
            }),
        }),
    ],
    providers: [AuthService, JwtStrategy, TokenManagerService],
    controllers: [AuthController],
    exports: [AuthService, JwtModule, TokenManagerService]
})
export class AuthModule { }

