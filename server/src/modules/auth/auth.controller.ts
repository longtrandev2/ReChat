import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    ResendVerificationDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    Enable2faDto,
    Disable2faDto,
    Verify2faLoginDto,
    Resend2faOtpDto,
} from "./dto/index.js";
import { AuthService } from "./auth.service.js";
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
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Đăng ký tài khoản mới (FR-01) - Gửi OTP qua email' })
    @ApiResponse({
        status: 201,
        description: 'Đăng ký tài khoản thành công, OTP đã gửi về email',
        schema: {
            example: {
                message: 'Đăng ký tài khoản thành công. Mã xác thực (OTP) đã được gửi đến email của bạn.',
                email: 'nguyenvana@gmail.com',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Dữ liệu không hợp lệ hoặc mật khẩu xác nhận không khớp',
    })
    @ApiResponse({
        status: 409,
        description: 'Username hoặc Email đã được sử dụng',
    })
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    /**
     * Xác thực tài khoản qua mã OTP email
     */
    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Xác thực tài khoản bằng mã OTP gửi về email' })
    @ApiResponse({
        status: 200,
        description: 'Xác thực thành công, trả về Access Token để đăng nhập luôn',
    })
    @ApiResponse({
        status: 400,
        description: 'Mã OTP không đúng hoặc đã hết hạn',
    })
    verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
        return this.authService.verifyEmail(verifyEmailDto);
    }

    /**
     * Gửi lại mã OTP xác thực
     */
    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 3, ttl: 60000 } })
    @ApiOperation({ summary: 'Gửi lại mã OTP xác thực email (Rate limit 60 giây)' })
    @ApiResponse({
        status: 200,
        description: 'Mã OTP mới đã được gửi về email',
    })
    @ApiResponse({
        status: 429,
        description: 'Yêu cầu quá nhanh, vui lòng đợi 60 giây',
    })
    resendVerification(@Body() resendDto: ResendVerificationDto) {
        return this.authService.resendVerification(resendDto);
    }

    /**
     * Đăng nhập (FR-02)
     */
    @Post('login')
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Đăng nhập vào hệ thống bằng Username hoặc Email (FR-02)' })
    @ApiResponse({
        status: 200,
        description: 'Đăng nhập thành công, trả về JWT Access Token hoặc yêu cầu 2FA Challenge',
    })
    @ApiResponse({
        status: 401,
        description: 'Sai tài khoản hoặc mật khẩu',
    })
    @ApiResponse({
        status: 403,
        description: 'Tài khoản chưa kích hoạt email',
    })
    login(@Body() loginDto: LoginDto, @Req() req?: Request) {
        const ip = req?.ip || req?.socket?.remoteAddress;
        const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
        return this.authService.login(loginDto, ip, userAgent);
    }

    /**
     * Xác thực 2FA khi đăng nhập (2FA Login Challenge)
     */
    @Post('2fa/verify-login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Xác thực mã OTP 2FA để hoàn tất đăng nhập' })
    @ApiResponse({
        status: 200,
        description: 'Xác thực 2FA thành công, cấp Access Token',
    })
    @ApiResponse({
        status: 400,
        description: 'Mã OTP không đúng hoặc phiên đăng nhập 2FA đã hết hạn',
    })
    verify2faLogin(@Body() verifyDto: Verify2faLoginDto, @Req() req?: Request) {
        const ip = req?.ip || req?.socket?.remoteAddress;
        const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
        return this.authService.verify2faLogin(verifyDto, ip, userAgent);
    }

    /**
     * Gửi lại mã OTP 2FA khi đăng nhập
     */
    @Post('2fa/resend-login-otp')
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 3, ttl: 60000 } })
    @ApiOperation({ summary: 'Gửi lại mã OTP 2FA trong phiên đăng nhập (Cooldown 60s)' })
    @ApiResponse({
        status: 200,
        description: 'Mã OTP 2FA mới đã được gửi về email',
    })
    resend2faLoginOtp(@Body() resendDto: Resend2faOtpDto) {
        return this.authService.resend2faLoginOtp(resendDto);
    }

    /**
     * Yêu cầu mã OTP bật xác thực 2 bước (Cài đặt)
     */
    @Post('2fa/send-setup-otp')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @Throttle({ auth: { limit: 3, ttl: 60000 } })
    @ApiOperation({ summary: 'Gửi mã OTP về email để chuẩn bị kích hoạt 2FA' })
    @ApiResponse({
        status: 200,
        description: 'Mã OTP đã được gửi về email',
    })
    send2faSetupOtp(@CurrentUser() user: User) {
        return this.authService.send2faSetupOtp(user);
    }

    /**
     * Kích hoạt xác thực 2 bước (Cài đặt)
     */
    @Post('2fa/enable')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Xác nhận mã OTP để chính thức bật 2FA' })
    @ApiResponse({
        status: 200,
        description: 'Bật 2FA thành công',
    })
    enable2fa(@CurrentUser() user: User, @Body() enableDto: Enable2faDto) {
        return this.authService.enable2fa(user, enableDto);
    }

    /**
     * Tắt xác thực 2 bước (Cài đặt)
     */
    @Post('2fa/disable')
    @HttpCode(HttpStatus.OK)
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Tắt tính năng 2FA (yêu cầu mật khẩu hiện tại)' })
    @ApiResponse({
        status: 200,
        description: 'Đã tắt 2FA thành công',
    })
    disable2fa(@CurrentUser() user: User, @Body() disableDto: Disable2faDto) {
        return this.authService.disable2fa(user, disableDto);
    }

    /**
     * Xem danh sách các phiên thiết bị đang đăng nhập
     */
    @Get('sessions')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Lấy danh sách các thiết bị đang đăng nhập tài khoản' })
    @ApiResponse({
        status: 200,
        description: 'Danh sách các phiên đăng nhập đang hoạt động',
    })
    getSessions(
        @CurrentUser() user: User,
        @Headers('x-device-id') deviceId?: string,
    ) {
        return this.authService.getUserSessions(user.id, deviceId);
    }

    /**
     * Đăng xuất từ xa một thiết bị
     */
    @Delete('sessions/:deviceId')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Thu hồi phiên đăng xuất từ xa một thiết bị cụ thể' })
    @ApiResponse({
        status: 200,
        description: 'Đã đăng xuất thiết bị thành công',
    })
    revokeSession(
        @CurrentUser() user: User,
        @Param('deviceId') deviceId: string,
    ) {
        return this.authService.revokeSession(user.id, deviceId);
    }

    /**
     * Yêu cầu đặt lại mật khẩu (Quên mật khẩu)
     */
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 3, ttl: 60000 } })
    @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu khi quên' })
    @ApiResponse({
        status: 200,
        description: 'Gửi email hướng dẫn đặt lại mật khẩu',
    })
    forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.forgotPassword(forgotPasswordDto);
    }

    /**
     * Đặt lại mật khẩu mới
     */
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @Throttle({ auth: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'Đặt lại mật khẩu mới bằng token nhận từ email' })
    @ApiResponse({
        status: 200,
        description: 'Đặt lại mật khẩu thành công',
    })
    @ApiResponse({
        status: 400,
        description: 'Token không hợp lệ hoặc mật khẩu xác nhận không khớp',
    })
    resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto);
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
    })
    @ApiResponse({
        status: 401,
        description: 'Chưa đăng nhập hoặc token không hợp lệ',
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
    @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống và đưa token vào blacklist (FR-04)' })
    @ApiResponse({
        status: 200,
        description: 'Đăng xuất thành công',
    })
    logout(
        @CurrentUser() user: User,
        @Req() req?: Request,
        @Headers('x-device-id') deviceId?: string,
    ) {
        const authHeader = req?.headers ? req.headers['authorization'] : undefined;
        const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        return this.authService.logout(user?.id, token, deviceId);
    }
}