import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity.js";
import * as bcrypt from 'bcrypt';
import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "./dto/register.dto.js";
import { AuthResponse } from "./dto/auth-response.dto.js";
import { LoginDto } from "./dto/login.dto.js";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
    ) { }

    //
    async register(dto: RegisterDto): Promise<AuthResponse> {
        if (dto.password !== dto.confirmPassword) {
            throw new BadRequestException('Mật khẩu xác nhận không khớp'); // 400
        }

        const existingUser = await this.userRepository.findOne({
            where: { username: dto.username }
        });

        if (existingUser) {
            throw new ConflictException('Username đã được sử dụng'); // 409
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const newUser = this.userRepository.create({
            username: dto.username,
            password: hashedPassword,
            displayName: dto.username,
        });

        let savedUser: User;
        try {
            savedUser = await this.userRepository.save(newUser);
        } catch (error: any) {
            // Xử lý race condition khi 2 request cùng username ghi đồng thời vào DB
            if (
                error?.code === 'ER_DUP_ENTRY' ||
                error?.errno === 1062 ||
                error?.message?.includes('Duplicate') ||
                error?.message?.includes('UNIQUE')
            ) {
                throw new ConflictException('Username đã được sử dụng');
            }
            throw error;
        }

        const token = await this.generateToken(savedUser.id, savedUser.username);

        return {
            accessToken: token,
            user: {
                id: savedUser.id,
                username: savedUser.username,
                displayName: savedUser.displayName,
                avatarUrl: savedUser.avatarUrl,
                createdAt: savedUser.createdAt,
            }
        };
    }

    async login(dto: LoginDto): Promise<AuthResponse> {
        const user = await this.userRepository.findOne({
            where: { username: dto.username }
        });

        if (!user) {
            throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng'); // 401
        }

        const isMatch = await bcrypt.compare(dto.password, user.password);

        if (!isMatch) {
            throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng'); // 401
        }

        const token = await this.generateToken(user.id, user.username);
        return {
            accessToken: token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            }
        };
    }

    private async generateToken(userId: string, username: string): Promise<string> {
        const payload = {
            sub: userId,
            username: username
        };

        return this.jwtService.signAsync(payload);
    }
}



