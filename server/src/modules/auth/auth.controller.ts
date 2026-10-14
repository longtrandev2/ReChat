import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RegisterDto } from "./dto/register.dto.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { AuthGuard } from "@nestjs/passport";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { User } from "../users/entities/user.entity.js";

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * Đăng ký tài khoản mới (FR-01)
     */
    @Post('register')
    @ApiOperation({ summary: 'Đăng ký tài khoản mới (FR-01)' })
    @ApiResponse({
        status: 201,
        description: 'Đăng ký tài khoản thành công',
        schema: {
            example: {
                message: 'Đăng ký tài khoản thành công',
                user: {
                    id: '550e8400-e29b-41d4-a716-446655440001',
                    username: 'nguyenvana',
                    displayName: null,
                    avatarUrl: null,
                    createdAt: '2026-10-14T10:00:00.000Z',
                },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Dữ liệu không hợp lệ hoặc mật khẩu xác nhận không khớp',
        schema: {
            example: { statusCode: 400, message: 'Mật khẩu xác nhận không khớp', error: 'Bad Request' },
        },
    })
    @ApiResponse({
        status: 409,
        description: 'Tên tài khoản đã tồn tại',
        schema: {
            example: { statusCode: 409, message: 'Tên tài khoản đã tồn tại', error: 'Conflict' },
        },
    })
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    /**
     * Đăng nhập (FR-02)
     */
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Đăng nhập vào hệ thống (FR-02)' })
    @ApiResponse({
        status: 200,
        description: 'Đăng nhập thành công, trả về JWT Access Token',
        schema: {
            example: {
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                user: {
                    id: '550e8400-e29b-41d4-a716-446655440001',
                    username: 'nguyenvana',
                    displayName: 'Nguyễn Văn A',
                    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nva',
                },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Sai tài khoản hoặc mật khẩu',
        schema: {
            example: { statusCode: 401, message: 'Tài khoản hoặc mật khẩu không chính xác', error: 'Unauthorized' },
        },
    })
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    /**
     * Lấy thông tin tài khoản đang đăng nhập (FR-03)
     */
    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Lấy thông tin tài khoản đang đăng nhập (FR-03)' })
    @ApiResponse({
        status: 200,
        description: 'Thông tin tài khoản hiện tại',
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440001',
                username: 'nguyenvana',
                displayName: 'Nguyễn Văn A',
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nva',
                createdAt: '2026-10-14T10:00:00.000Z',
                updatedAt: '2026-10-14T10:00:00.000Z',
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Chưa đăng nhập hoặc token không hợp lệ',
        schema: {
            example: { statusCode: 401, message: 'Unauthorized' },
        },
    })
    getProfile(@CurrentUser() user: User) {
        return user;
    }

    /**
     * Đăng xuất (FR-04)
     */
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống (FR-04)' })
    @ApiResponse({
        status: 200,
        description: 'Đăng xuất thành công',
        schema: {
            example: { message: 'Đăng xuất thành công' },
        },
    })
    logout() {
        return { message: 'Đăng xuất thành công' };
    }
}