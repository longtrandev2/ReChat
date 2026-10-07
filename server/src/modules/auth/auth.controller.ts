import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { RegisterDto } from "./dto/register.dto.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { AuthGuard } from "@nestjs/passport";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { User } from "../users/entities/user.entity.js";


@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {

    }
    @Post('register')
    register(@Body() registerDto: RegisterDto) {

        return this.authService.register(registerDto);

    }
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() loginDto: LoginDto) {

        return this.authService.login(loginDto);
    }

    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    getProfile(@CurrentUser() user: User) {
        return user;
    }

    @Post('logout')
    @UseGuards(AuthGuard('jwt'))
    logout() {
        return { message: 'Đăng xuất thành công' };
    }
}