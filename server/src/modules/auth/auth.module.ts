import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/user.module.js';
import { AuthService } from './auth.service.js';

@Module({
    imports: [
        UsersModule, // Import UsersModule để dùng Repository<User>
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET || 'secretKeyChatApp123', // Khóa bí mật ký JWT
            signOptions: { expiresIn: '7d' }, // Token có thời hạn 7 ngày
        }),
    ],
    providers: [AuthService],
    exports: [AuthService]
    // ...
})
export class AuthModule { }
