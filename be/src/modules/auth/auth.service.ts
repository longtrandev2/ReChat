import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    HttpStatus,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity.js";
import * as bcrypt from 'bcrypt';
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { RedisService } from "../../common/redis/redis.service.js";
import { MailService } from "../../common/mail/mail.service.js";
import {
    RegisterDto,
    LoginDto,
    AuthResponse,
    LoginResult,
    VerifyEmailDto,
    ResendVerificationDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    Enable2faDto,
    Disable2faDto,
    Verify2faLoginDto,
    Resend2faOtpDto,
} from "./dto/index.js";
import { ConfigService } from "@nestjs/config";
import { TokenManagerService } from "./token-manager.service.js";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly redisService: RedisService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
        private readonly tokenManagerService: TokenManagerService,
    ) { }

    async register(dto: RegisterDto): Promise<{ message: string; email?: string }> {
        if (dto.password !== dto.confirmPassword) {
            throw new BadRequestException('Mật khẩu xác nhận không khớp'); // 400
        }

        const normalizedEmail = dto.email ? dto.email.trim().toLowerCase() : undefined;

        // Kiểm tra trùng username hoặc email
        const whereConditions: any[] = [{ username: dto.username }];
        if (normalizedEmail) {
            whereConditions.push({ email: normalizedEmail });
        }

        const existingUser = await this.userRepository.findOne({
            where: whereConditions,
        });

        if (existingUser) {
            if (existingUser.username === dto.username) {
                throw new ConflictException('Username đã được sử dụng'); // 409
            }
            if (normalizedEmail && existingUser.email === normalizedEmail) {
                throw new ConflictException('Email đã được sử dụng'); // 409
            }
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const newUser = this.userRepository.create({
            username: dto.username,
            email: normalizedEmail,
            isEmailVerified: false,
            password: hashedPassword,
            displayName: dto.username,
        });

        let savedUser: User;
        try {
            savedUser = await this.userRepository.save(newUser);
        } catch (error: any) {
            // Xử lý race condition khi 2 request cùng username hoặc email ghi đồng thời
            if (
                error?.code === 'ER_DUP_ENTRY' ||
                error?.errno === 1062 ||
                error?.message?.includes('Duplicate') ||
                error?.message?.includes('UNIQUE')
            ) {
                throw new ConflictException('Username hoặc Email đã được sử dụng');
            }
            throw error;
        }

        // Sinh mã OTP 6 số ngẫu nhiên và lưu vào Redis (TTL 15 phút = 900s)
        if (normalizedEmail) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await this.redisService.set(`email_verify:${normalizedEmail}`, otp, 900);

            // Đẩy email xác nhận vào BullMQ Queue
            await this.mailService.sendVerificationEmail(normalizedEmail, savedUser.username, otp);
        }

        return {
            message: 'Đăng ký tài khoản thành công. Mã xác thực (OTP) đã được gửi đến email của bạn.',
            email: normalizedEmail,
        };
    }

    async verifyEmail(dto: VerifyEmailDto): Promise<AuthResponse & { message: string }> {
        const normalizedEmail = dto.email.trim().toLowerCase();
        const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });

        if (!user) {
            throw new NotFoundException('Không tìm thấy tài khoản với email này');
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Email đã được xác thực trước đó');
        }

        const cachedOtp = await this.redisService.get(`email_verify:${normalizedEmail}`);
        if (!cachedOtp) {
            throw new BadRequestException('Mã OTP đã hết hạn hoặc không tồn tại');
        }

        if (cachedOtp !== dto.otp.trim()) {
            throw new BadRequestException('Mã OTP không chính xác');
        }

        // Kích hoạt tài khoản
        user.isEmailVerified = true;
        await this.userRepository.save(user);

        // Xóa OTP khỏi Redis
        await this.redisService.del(`email_verify:${normalizedEmail}`);

        const token = await this.generateToken(user.id, user.username);
        return {
            message: 'Xác thực email thành công',
            accessToken: token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
        };
    }

    async resendVerification(dto: ResendVerificationDto): Promise<{ message: string }> {
        const normalizedEmail = dto.email.trim().toLowerCase();
        const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });

        if (!user) {
            throw new NotFoundException('Không tìm thấy tài khoản với email này');
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Email đã được xác thực trước đó');
        }

        const isLimited = await this.redisService.exists(`resend_limit:${normalizedEmail}`);
        if (isLimited) {
            throw new HttpException('Vui lòng đợi 60 giây trước khi yêu cầu gửi lại mã mới', HttpStatus.TOO_MANY_REQUESTS);
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redisService.set(`email_verify:${normalizedEmail}`, otp, 900);
        await this.redisService.set(`resend_limit:${normalizedEmail}`, '1', 60);

        await this.mailService.sendVerificationEmail(normalizedEmail, user.username, otp);

        return {
            message: 'Mã OTP mới đã được gửi về email của bạn.',
        };
    }

    async login(dto: LoginDto, clientIp?: string, userAgent?: string, deviceId?: string): Promise<LoginResult> {
        const account = dto.username.trim();

        // Cho phép đăng nhập bằng cả username HOẶC email
        const user = await this.userRepository.findOne({
            where: [
                { username: account },
                { email: account.toLowerCase() },
            ],
        });

        if (!user) {
            throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng'); // 401
        }

        const isMatch = await bcrypt.compare(dto.password, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng'); // 401
        }

        // Kiểm tra kích hoạt tài khoản qua email (chỉ áp dụng nếu user có khai báo email)
        if (user.email && !user.isEmailVerified) {
            throw new ForbiddenException('Tài khoản chưa được kích hoạt. Vui lòng xác thực email trước khi đăng nhập');
        }

        // Kiểm tra xác thực 2 bước (2FA qua Email OTP)
        if (user.twoFactorEnabled && user.email) {
            const mfaToken = randomUUID();
            const otp = Math.floor(100000 + Math.random() * 900000).toString();

            // Lưu phiên 2FA tạm thời vào Redis (TTL 5 phút = 300s)
            const mfaData = {
                userId: user.id,
                email: user.email,
                username: user.username,
                otp,
                attempts: 0,
                deviceId: deviceId || dto.deviceId,
                clientIp,
                userAgent,
            };
            await this.redisService.set(`mfa_login:${mfaToken}`, JSON.stringify(mfaData), 300);

            // Gửi OTP đăng nhập qua BullMQ Mail Queue
            await this.mailService.sendTwoFactorOtpEmail(user.email, user.username, otp, 'login');

            return {
                requires2FA: true,
                mfaToken,
                maskedEmail: this.maskEmail(user.email),
            };
        }

        const effectiveDeviceId = deviceId || dto.deviceId || 'default-device';
        const tokenPair = await this.tokenManagerService.generateTokenPair(
            { id: user.id, username: user.username },
            effectiveDeviceId,
        );

        // Lưu session nếu client gửi kèm deviceId
        await this.redisService.saveSession(user.id, effectiveDeviceId, {
            ip: clientIp || 'unknown',
            userAgent: userAgent || 'unknown',
        });

        return {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
        };
    }

    async send2faSetupOtp(user: User): Promise<{ message: string; maskedEmail: string }> {
        if (!user.email) {
            throw new BadRequestException('Tài khoản chưa có email để thiết lập xác thực 2 bước');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redisService.set(`2fa_setup:${user.id}`, otp, 300); // 5 phút

        await this.mailService.sendTwoFactorOtpEmail(user.email, user.username, otp, 'setup');

        return {
            message: 'Mã xác thực đã được gửi về email của bạn.',
            maskedEmail: this.maskEmail(user.email),
        };
    }

    async enable2fa(user: User, dto: Enable2faDto): Promise<{ message: string }> {
        const cachedOtp = await this.redisService.get(`2fa_setup:${user.id}`);
        if (!cachedOtp) {
            throw new BadRequestException('Mã xác thực đã hết hạn hoặc không tồn tại. Vui lòng thử lại');
        }

        if (cachedOtp !== dto.otp.trim()) {
            throw new BadRequestException('Mã xác thực không chính xác');
        }

        user.twoFactorEnabled = true;
        await this.userRepository.save(user);

        await this.redisService.del(`2fa_setup:${user.id}`);

        return {
            message: 'Xác thực 2 bước (2FA) đã được kích hoạt thành công cho tài khoản của bạn.',
        };
    }

    async disable2fa(user: User, dto: Disable2faDto): Promise<{ message: string }> {
        const isMatch = await bcrypt.compare(dto.password, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('Mật khẩu không chính xác');
        }

        user.twoFactorEnabled = false;
        await this.userRepository.save(user);

        return {
            message: 'Đã tắt tính năng xác thực 2 bước (2FA) thành công.',
        };
    }

    async verify2faLogin(
        dto: Verify2faLoginDto,
        clientIp?: string,
        userAgent?: string,
        deviceId?: string,
    ): Promise<AuthResponse> {
        const cachedRaw = await this.redisService.get(`mfa_login:${dto.mfaToken}`);
        if (!cachedRaw) {
            throw new BadRequestException('Phiên xác thực 2FA đã hết hạn hoặc không tồn tại');
        }

        const mfaData = JSON.parse(cachedRaw);

        if (mfaData.attempts >= 5) {
            await this.redisService.del(`mfa_login:${dto.mfaToken}`);
            throw new BadRequestException('Nhập sai mã OTP quá 5 lần. Vui lòng đăng nhập lại.');
        }

        if (mfaData.otp !== dto.otp.trim()) {
            mfaData.attempts += 1;
            await this.redisService.set(`mfa_login:${dto.mfaToken}`, JSON.stringify(mfaData), 300);
            throw new BadRequestException('Mã xác thực không chính xác');
        }

        // Xác thực thành công -> xóa phiên MFA tạm
        await this.redisService.del(`mfa_login:${dto.mfaToken}`);

        const user = await this.userRepository.findOne({ where: { id: mfaData.userId } });
        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        const effectiveDeviceId = deviceId || dto.deviceId || mfaData.deviceId || 'default-device';
        const tokenPair = await this.tokenManagerService.generateTokenPair(
            { id: user.id, username: user.username },
            effectiveDeviceId,
        );

        await this.redisService.saveSession(user.id, effectiveDeviceId, {
            ip: clientIp || mfaData.clientIp || 'unknown',
            userAgent: userAgent || mfaData.userAgent || 'unknown',
        });

        return {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
        };
    }

    async resend2faLoginOtp(dto: Resend2faOtpDto): Promise<{ message: string }> {
        const cachedRaw = await this.redisService.get(`mfa_login:${dto.mfaToken}`);
        if (!cachedRaw) {
            throw new BadRequestException('Phiên xác thực 2FA đã hết hạn hoặc không tồn tại');
        }

        const isLimited = await this.redisService.exists(`resend_2fa_limit:${dto.mfaToken}`);
        if (isLimited) {
            throw new HttpException('Vui lòng đợi 60 giây trước khi yêu cầu mã mới', HttpStatus.TOO_MANY_REQUESTS);
        }

        const mfaData = JSON.parse(cachedRaw);
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        mfaData.otp = newOtp;
        mfaData.attempts = 0;

        await this.redisService.set(`mfa_login:${dto.mfaToken}`, JSON.stringify(mfaData), 300);
        await this.redisService.set(`resend_2fa_limit:${dto.mfaToken}`, '1', 60);

        await this.mailService.sendTwoFactorOtpEmail(mfaData.email, mfaData.username, newOtp, 'login');

        return {
            message: 'Mã xác thực mới đã được gửi về email của bạn.',
        };
    }

    async getUserSessions(userId: string, currentDeviceId?: string): Promise<Record<string, any>[]> {
        const sessions = await this.redisService.getUserSessions(userId);
        return sessions.map((session) => ({
            ...session,
            isCurrentDevice: currentDeviceId ? session.deviceId === currentDeviceId : false,
        }));
    }

    async revokeSession(userId: string, targetDeviceId: string): Promise<{ message: string }> {
        await this.redisService.deleteSession(userId, targetDeviceId);
        return {
            message: `Đã kết thúc phiên đăng nhập của thiết bị ${targetDeviceId}`,
        };
    }

    async refreshTokens(rawRefreshToken: string, deviceId?: string): Promise<AuthResponse> {
        const newPair = await this.tokenManagerService.rotateRefreshToken(rawRefreshToken, deviceId);

        const user = await this.userRepository.findOne({ where: { id: newPair.userId } });
        if (!user) {
            throw new UnauthorizedException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
        }

        return {
            accessToken: newPair.accessToken,
            refreshToken: newPair.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
        };
    }

    async logout(
        userId?: string,
        token?: string,
        deviceId?: string,
        rawRefreshToken?: string,
    ): Promise<{ message: string }> {
        // 1. Thu hồi Refresh Token trên Redis
        if (rawRefreshToken) {
            const parsed = this.tokenManagerService.parseRawRefreshToken(rawRefreshToken);
            if (parsed) {
                await this.tokenManagerService.revokeToken(parsed.tokenId);
            }
        }

        // 2. Blacklist Access Token (JTI và token string)
        if (token) {
            try {
                const decoded = this.jwtService.decode(token) as any;
                const now = Math.floor(Date.now() / 1000);
                const ttl = decoded?.exp ? Math.max(1, decoded.exp - now) : 900;
                if (decoded?.jti) {
                    await this.redisService.blacklistToken(decoded.jti, ttl);
                }
                await this.redisService.blacklistToken(token, ttl);
            } catch {
                await this.redisService.blacklistToken(token, 900);
            }
        }

        // 3. Xóa thiết bị khỏi danh sách sessions
        if (userId && deviceId) {
            await this.redisService.deleteSession(userId, deviceId);
        }

        return {
            message: 'Đăng xuất thành công',
        };
    }

    async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
        const normalizedEmail = dto.email.trim().toLowerCase();
        const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });

        // Chống User Enumeration: dù user có tồn tại hay không vẫn trả về thông báo chung
        if (user) {
            const resetToken = randomUUID();
            await this.redisService.set(`pwd_reset:${resetToken}`, user.id, 900); // 15 phút

            const clientUrl = (this.configService.get<string>('CLIENT_URL') || 'http://localhost:5173').replace(/\/+$/, '');
            const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;
            await this.mailService.sendPasswordResetEmail(normalizedEmail, user.username, resetLink);
        }

        return {
            message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đi.',
        };
    }

    async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException('Mật khẩu xác nhận không khớp');
        }

        const userId = await this.redisService.get(`pwd_reset:${dto.token}`);
        if (!userId) {
            throw new BadRequestException('Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
        }

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
        user.password = hashedPassword;
        await this.userRepository.save(user);

        // Xóa token đặt lại mật khẩu
        await this.redisService.del(`pwd_reset:${dto.token}`);

        // Xóa toàn bộ phiên đăng nhập cũ trên mọi thiết bị (đá văng thiết bị cũ)
        await this.redisService.deleteAllUserSessions(user.id);

        return {
            message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.',
        };
    }

    private maskEmail(email: string): string {
        const [name, domain] = email.split('@');
        if (!domain) return email;
        if (name.length <= 2) {
            return `${name[0]}*@${domain}`;
        }
        return `${name[0]}${'*'.repeat(Math.max(name.length - 2, 3))}${name[name.length - 1]}@${domain}`;
    }

    private async generateToken(userId: string, username: string): Promise<string> {
        const payload = {
            sub: userId,
            username: username,
        };

        return this.jwtService.signAsync(payload);
    }
}
