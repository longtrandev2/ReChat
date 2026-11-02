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
    ChangePasswordDto,
} from "./dto/index.js";
import { ConfigService } from "@nestjs/config";
import { TokenManagerService } from "./token-manager.service.js";
import { toAuthUser } from "./auth-user.mapper.js";
import { assertOtpAttempt } from "./otp-attempt-guard.js";
import { REFRESH_TOKEN_TTL_SECONDS } from "./constants/auth-cookie.constants.js";
import { generateOtp } from "../../common/utils/generate-otp.js";
import { userMinIssuedAtKey } from "../../common/auth/access-token-revocation.js";
import { getPrimaryClientUrl } from "../../common/config/cors-origins.js";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
    AUTH_SESSIONS_REVOKED,
    AuthSessionsRevokedEvent,
    type RevokedSessionScope,
} from "../../common/events/auth-session.events.js";

/** Số lần gửi lại OTP 2FA đăng nhập tối đa cho một mfaToken */
const MAX_2FA_LOGIN_RESENDS = 3;
/** Số lần gửi lại OTP xác thực email tối đa mỗi giờ (mỗi lần gửi lại cấp thêm 5 lượt thử) */
const MAX_EMAIL_OTP_RESENDS_PER_HOUR = 5;
/** Cột cần cho đăng nhập: `password` có select:false trong entity nên phải chọn tường minh */
const USER_WITH_PASSWORD_SELECT = {
    id: true,
    username: true,
    email: true,
    password: true,
    isEmailVerified: true,
    twoFactorEnabled: true,
    displayName: true,
    avatarUrl: true,
    createdAt: true,
} as const;
const emailVerifyAttemptsKey = (email: string) => `email_verify_attempts:${email}`;
const emailVerifyResendsKey = (email: string) => `email_verify_resends:${email}`;
const mfaLoginAttemptsKey = (mfaToken: string) => `mfa_login_attempts:${mfaToken}`;
const twoFactorSetupAttemptsKey = (userId: string) => `2fa_setup_attempts:${userId}`;
/**
 * 401 do sai mật khẩu xác nhận (không phải do token hết hạn): FE dựa vào mã này để KHÔNG kích hoạt silent refresh.
 */
export const INVALID_CURRENT_PASSWORD = 'INVALID_CURRENT_PASSWORD';

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
        private readonly eventEmitter: EventEmitter2,
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
            const otp = generateOtp();
            await this.redisService.set(`email_verify:${normalizedEmail}`, otp, 900);

            // Đẩy email xác nhận vào BullMQ Queue
            await this.mailService.sendVerificationEmail(normalizedEmail, savedUser.username, otp);
        }

        return {
            message: 'Đăng ký tài khoản thành công. Mã xác thực (OTP) đã được gửi đến email của bạn.',
            email: normalizedEmail,
        };
    }

    async verifyEmail(
        dto: VerifyEmailDto,
        clientIp?: string,
        userAgent?: string,
        deviceId?: string,
    ): Promise<AuthResponse & { message: string }> {
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

        await assertOtpAttempt(this.redisService, {
            otpKey: `email_verify:${normalizedEmail}`,
            counterKey: emailVerifyAttemptsKey(normalizedEmail),
            ttlSeconds: 900,
            isMatch: cachedOtp === dto.otp.trim(),
            exceededMessage: 'Nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.',
            wrongMessage: 'Mã OTP không chính xác',
        });

        // Kích hoạt tài khoản
        user.isEmailVerified = true;
        await this.userRepository.save(user);

        // Xóa OTP và bộ đếm nhập sai khỏi Redis
        await this.redisService.del(`email_verify:${normalizedEmail}`, emailVerifyAttemptsKey(normalizedEmail));

        // Cấp cặp token chuẩn (Access 15 phút + Refresh cookie) và ghi session như luồng login
        const effectiveDeviceId = deviceId || 'default-device';
        const tokenPair = await this.tokenManagerService.generateTokenPair(
            { id: user.id, username: user.username },
            effectiveDeviceId,
        );
        await this.recordSession(user.id, effectiveDeviceId, clientIp, userAgent);

        return {
            message: 'Xác thực email thành công',
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            user: toAuthUser(user),
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

        // Mỗi lần gửi lại cấp 5 lượt thử mới => giới hạn số lần gửi lại để tổng số lượt đoán có trần
        const resends = await this.redisService.incr(emailVerifyResendsKey(normalizedEmail), 3600);
        if (resends > MAX_EMAIL_OTP_RESENDS_PER_HOUR) {
            throw new HttpException('Bạn đã yêu cầu gửi lại mã quá nhiều lần. Vui lòng thử lại sau 1 giờ.', HttpStatus.TOO_MANY_REQUESTS);
        }

        const otp = generateOtp();
        await this.redisService.set(`email_verify:${normalizedEmail}`, otp, 900);
        await this.redisService.del(emailVerifyAttemptsKey(normalizedEmail));
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
            select: USER_WITH_PASSWORD_SELECT,
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
            const otp = generateOtp();

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

        await this.recordSession(user.id, effectiveDeviceId, clientIp, userAgent);

        return {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            user: toAuthUser(user),
        };
    }

    /**
     * Ghi / gia hạn phiên đăng nhập hiển thị ở Cài đặt > Thiết bị.
     * TTL bằng Refresh Token (30 ngày): thiết bị còn đăng nhập thì luôn còn trong danh sách và luôn thu hồi được.
     */
    private async recordSession(userId: string, deviceId: string, clientIp?: string, userAgent?: string): Promise<void> {
        await this.redisService.saveSession(
            userId,
            deviceId,
            {
                ip: clientIp || 'unknown',
                userAgent: userAgent || 'unknown',
            },
            REFRESH_TOKEN_TTL_SECONDS,
        );
    }

    async send2faSetupOtp(user: User): Promise<{ message: string; maskedEmail: string }> {
        if (!user.email) {
            throw new BadRequestException('Tài khoản chưa có email để thiết lập xác thực 2 bước');
        }

        const otp = generateOtp();
        await this.redisService.set(`2fa_setup:${user.id}`, otp, 300); // 5 phút
        await this.redisService.del(twoFactorSetupAttemptsKey(user.id));

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

        await assertOtpAttempt(this.redisService, {
            otpKey: `2fa_setup:${user.id}`,
            counterKey: twoFactorSetupAttemptsKey(user.id),
            ttlSeconds: 300,
            isMatch: cachedOtp === dto.otp.trim(),
            exceededMessage: 'Nhập sai mã quá 5 lần. Vui lòng yêu cầu gửi mã mới.',
            wrongMessage: 'Mã xác thực không chính xác',
        });

        // Chỉ cập nhật đúng cột twoFactorEnabled (req.user không chứa password, không save cả entity)
        await this.userRepository.update(user.id, { twoFactorEnabled: true });

        await this.redisService.del(`2fa_setup:${user.id}`);

        return {
            message: 'Xác thực 2 bước (2FA) đã được kích hoạt thành công cho tài khoản của bạn.',
        };
    }

    async disable2fa(user: User, dto: Disable2faDto): Promise<{ message: string }> {
        // JwtStrategy đã loại bỏ password khỏi req.user => phải đọc lại hash từ DB
        const dbUser = await this.findUserWithPasswordOrFail(user.id);
        const isMatch = await bcrypt.compare(dto.password, dbUser.password);
        if (!isMatch) {
            throw new UnauthorizedException({ errorCode: INVALID_CURRENT_PASSWORD, message: 'Mật khẩu không chính xác' });
        }

        await this.userRepository.update(user.id, { twoFactorEnabled: false });

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

        // Bộ đếm riêng (INCR) thay vì ghi lại JSON: tránh vượt giới hạn khi gửi song song và tránh ghi đè OTP mới
        await assertOtpAttempt(this.redisService, {
            otpKey: `mfa_login:${dto.mfaToken}`,
            counterKey: mfaLoginAttemptsKey(dto.mfaToken),
            ttlSeconds: 300,
            isMatch: mfaData.otp === dto.otp.trim(),
            exceededMessage: 'Nhập sai mã OTP quá 5 lần. Vui lòng đăng nhập lại.',
            wrongMessage: 'Mã xác thực không chính xác',
        });

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

        await this.recordSession(
            user.id,
            effectiveDeviceId,
            clientIp || mfaData.clientIp,
            userAgent || mfaData.userAgent,
        );

        return {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            user: toAuthUser(user),
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
        // KHÔNG reset bộ đếm lượt sai: nếu reset, kẻ tấn công đoán OTP vô hạn bằng cách gửi lại mã liên tục (BR-25)
        const resends = Number(mfaData.resends || 0);
        if (resends >= MAX_2FA_LOGIN_RESENDS) {
            throw new BadRequestException('Đã vượt quá số lần gửi lại mã. Vui lòng đăng nhập lại.');
        }
        const newOtp = generateOtp();
        mfaData.otp = newOtp;
        mfaData.resends = resends + 1;

        await this.redisService.set(`mfa_login:${dto.mfaToken}`, JSON.stringify(mfaData), 300);
        // Gia hạn bộ đếm lượt sai cùng phiên MFA để bộ đếm không hết hạn trước (tránh reset lượt thử)
        await this.redisService.expire(mfaLoginAttemptsKey(dto.mfaToken), 300);
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
        // Thu hồi thật: hủy refresh token family + chặn access token đang dùng của thiết bị (BR-27)
        await this.tokenManagerService.revokeDevice(userId, targetDeviceId);
        await this.redisService.deleteSession(userId, targetDeviceId);
        this.emitSessionsRevoked(userId, { type: 'devices', deviceIds: [targetDeviceId] });
        return {
            message: `Đã kết thúc phiên đăng nhập của thiết bị ${targetDeviceId}`,
        };
    }

    async refreshTokens(
        rawRefreshToken: string,
        deviceId?: string,
        clientIp?: string,
        userAgent?: string,
    ): Promise<AuthResponse> {
        const newPair = await this.tokenManagerService.rotateRefreshToken(rawRefreshToken, deviceId);

        const user = await this.userRepository.findOne({ where: { id: newPair.userId } });
        if (!user) {
            throw new UnauthorizedException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
        }

        // Gia hạn session + cập nhật lastActiveAt để danh sách thiết bị phản ánh đúng thiết bị còn hoạt động
        await this.recordSession(user.id, newPair.deviceId, clientIp, userAgent);

        return {
            accessToken: newPair.accessToken,
            refreshToken: newPair.refreshToken,
            user: toAuthUser(user),
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
                const decoded = this.jwtService.decode(token) as { exp?: number; jti?: string } | null;
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

        // 3. Hủy toàn bộ token family của thiết bị và xóa khỏi danh sách sessions
        if (userId && deviceId) {
            await this.tokenManagerService.revokeDevice(userId, deviceId);
            await this.redisService.deleteSession(userId, deviceId);
            this.emitSessionsRevoked(userId, { type: 'devices', deviceIds: [deviceId] });
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

            // CLIENT_URL có thể chứa nhiều origin (CORS whitelist) => link email dùng origin chính
            const clientUrl = getPrimaryClientUrl(this.configService.get<string>('CLIENT_URL'));
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

        // Thu hồi thật toàn bộ phiên trên mọi thiết bị (BR-24): refresh token family + access token đang dùng
        await this.tokenManagerService.revokeAllDevices(user.id);
        await this.redisService.deleteAllUserSessions(user.id);
        // Chặn cả token cấp trước khi có chỉ mục thiết bị (không nằm trong user_token_devices)
        // Mốc ms dùng cho cả Access Token (claim iatMs) và /auth/refresh (metadata.createdAt)
        await this.redisService.set(userMinIssuedAtKey(user.id), String(Date.now()), REFRESH_TOKEN_TTL_SECONDS);
        this.emitSessionsRevoked(user.id, { type: 'all' });

        return {
            message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.',
        };
    }

    /**
     * Đổi mật khẩu trong Cài đặt (FR-49, BR-39).
     * Đổi thành công thì đăng xuất mọi thiết bị KHÁC (giữ thiết bị hiện tại) để kẻ đang chiếm phiên bị đá ra.
     */
    async changePassword(
        user: User,
        dto: ChangePasswordDto,
        currentDeviceId?: string,
    ): Promise<{ message: string; revokedSessions: number }> {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException('Mật khẩu xác nhận không khớp');
        }

        if (dto.currentPassword === dto.newPassword) {
            throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu hiện tại');
        }

        // JwtStrategy đã loại bỏ password khỏi req.user => phải đọc lại hash từ DB
        const dbUser = await this.findUserWithPasswordOrFail(user.id);
        const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, dbUser.password);
        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException({
                errorCode: INVALID_CURRENT_PASSWORD,
                message: 'Mật khẩu hiện tại không chính xác',
            });
        }

        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
        await this.userRepository.update(user.id, { password: hashedPassword });

        const revokedDeviceIds = await this.tokenManagerService.revokeAllDevices(user.id, currentDeviceId);
        for (const deviceId of revokedDeviceIds) {
            await this.redisService.deleteSession(user.id, deviceId);
        }
        this.emitSessionsRevoked(
            user.id,
            currentDeviceId ? { type: 'allExcept', deviceId: currentDeviceId } : { type: 'all' },
        );

        return {
            message: 'Đổi mật khẩu thành công. Các thiết bị khác đã được đăng xuất.',
            revokedSessions: revokedDeviceIds.length,
        };
    }

    /** Phát domain event để ChatGateway ngắt các kết nối WebSocket của thiết bị bị thu hồi */
    private emitSessionsRevoked(userId: string, scope: RevokedSessionScope): void {
        this.eventEmitter.emit(AUTH_SESSIONS_REVOKED, new AuthSessionsRevokedEvent(userId, scope));
    }

    private async findUserWithPasswordOrFail(userId: string): Promise<User> {
        const dbUser = await this.userRepository.findOne({ where: { id: userId }, select: { id: true, password: true } });
        if (!dbUser) {
            throw new NotFoundException('Người dùng không tồn tại');
        }
        return dbUser;
    }

    private maskEmail(email: string): string {
        const [name, domain] = email.split('@');
        if (!domain) return email;
        if (name.length <= 2) {
            return `${name[0]}*@${domain}`;
        }
        return `${name[0]}${'*'.repeat(Math.max(name.length - 2, 3))}${name[name.length - 1]}@${domain}`;
    }
}
