import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity.js";
import * as bcrypt from 'bcrypt';
import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "./dto/register.dto.js";
import { AuthResponse } from "./dto/auth-response.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import e from "express";


@Injectable()
export class AuthService {

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private readonly jwtService: JwtService,
    ) { }



    //
    async register(dto: RegisterDto): Promise<AuthResponse> {
        if (dto.password !== dto.confirmPassword)
            throw new BadRequestException('Mật khẩu xác nhận không khớp');//400

        const existingUser = await this.userRepository.findOne({
            where: { username: dto.username }
        })

        if (existingUser)
            throw new ConflictException('Username đã được sử dụng') //409

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const newUser = this.userRepository.create({
            username: dto.username,
            password: hashedPassword,
        })

        const savedUser = await this.userRepository.save(newUser);

        const token = await this.generateToken(savedUser.id, savedUser.username);

        return {
            accessToken: token,
            user: {
                id: savedUser.id,
                username: savedUser.username,
                createdAt: savedUser.createdAt
            }
        }
    }

    async login(dto: LoginDto): Promise<AuthResponse> {
        const user = await this.userRepository.findOne(
            {
                where: { username: dto.username }
            }
        )
        if (!user)
            throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng') //401


        const isMatch = await bcrypt.compare(dto.password, user.password)

        if (!isMatch)
            throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng') //401

        const token = await this.generateToken(user.id, user.username)
        return {
            accessToken: token,
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.createdAt,
            }
        }
    }

    private async generateToken(userId: string, username: string): Promise<string> {
        const payload =
        {
            sub: userId, username
        }

        return this.jwtService.signAsync(payload);
    }
}



