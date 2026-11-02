import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../common/redis/redis.service.js';
import { MailService } from '../../common/mail/mail.service.js';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { TokenManagerService } from './token-manager.service.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUTH_SESSIONS_REVOKED } from '../../common/events/auth-session.events.js';

describe('AuthService', () => {
    let service: AuthService;
    let mockUserRepository: any;
    let mockJwtService: any;
    let mockRedisService: any;
    let mockMailService: any;
    let mockTokenManagerService: any;
    let mockEventEmitter: { emit: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        mockUserRepository = {
            findOne: vi.fn(),
            create: vi.fn((dto) => dto),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
            save: vi.fn((user) => Promise.resolve({
                id: 'uuid-1234',
                createdAt: new Date('2026-10-05T00:00:00.000Z'),
                ...user,
            })),
        };

        mockJwtService = {
            signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
            decode: vi.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 900, jti: 'mock-jti' }),
        };

        mockTokenManagerService = {
            generateTokenPair: vi.fn().mockResolvedValue({
                accessToken: 'mock-jwt-token',
                refreshToken: 'token-uuid.secret-key',
                familyId: 'family-1',
                deviceId: 'dev-1',
                jti: 'jti-1',
                userId: 'user-1',
            }),
            rotateRefreshToken: vi.fn().mockResolvedValue({
                accessToken: 'new-jwt-token',
                refreshToken: 'new-token-uuid.new-secret-key',
                familyId: 'family-1',
                deviceId: 'dev-1',
                jti: 'jti-2',
                userId: 'user-1',
            }),
            parseRawRefreshToken: vi.fn().mockReturnValue({
                tokenId: 'token-uuid',
                secret: 'secret-key',
            }),
            revokeToken: vi.fn().mockResolvedValue(undefined),
            revokeFamily: vi.fn().mockResolvedValue(undefined),
            revokeDevice: vi.fn().mockResolvedValue(undefined),
            revokeAllDevices: vi.fn().mockResolvedValue([]),
        };

        mockRedisService = {
            get: vi.fn(),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            exists: vi.fn().mockResolvedValue(0),
            incr: vi.fn().mockResolvedValue(1),
            expire: vi.fn().mockResolvedValue(1),
            saveSession: vi.fn().mockResolvedValue(undefined),
            getSession: vi.fn().mockResolvedValue(null),
            getUserSessions: vi.fn().mockResolvedValue([]),
            deleteSession: vi.fn().mockResolvedValue(undefined),
            deleteAllUserSessions: vi.fn().mockResolvedValue(undefined),
            blacklistToken: vi.fn().mockResolvedValue(undefined),
            isTokenBlacklisted: vi.fn().mockResolvedValue(false),
        };

        mockMailService = {
            sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
            sendTwoFactorOtpEmail: vi.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: MailService,
                    useValue: mockMailService,
                },
                {
                    provide: TokenManagerService,
                    useValue: mockTokenManagerService,
                },
                {
                    provide: EventEmitter2,
                    useValue: (mockEventEmitter = { emit: vi.fn() }),
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: vi.fn((key: string) => {
                            if (key === 'CLIENT_URL') return 'http://localhost:5173';
                            return null;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('register', () => {
        const registerDto = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            confirmPassword: 'password123',
        };

        it('should successfully register a user, cache OTP and queue email', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);

            const result = await service.register(registerDto);

            expect(result).toBeDefined();
            expect(result.message).toContain('Đăng ký tài khoản thành công');
            expect(result.email).toBe('test@example.com');
            expect(mockUserRepository.save).toHaveBeenCalled();
            expect(mockRedisService.set).toHaveBeenCalled();
            expect(mockMailService.sendVerificationEmail).toHaveBeenCalled();
        });

        it('should throw BadRequestException if password does not match confirmPassword', async () => {
            const invalidDto = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'mismatch_password',
            };

            await expect(service.register(invalidDto)).rejects.toThrow(BadRequestException);
            expect(mockUserRepository.findOne).not.toHaveBeenCalled();
        });

        it('should throw ConflictException if username already exists', async () => {
            mockUserRepository.findOne.mockResolvedValue({ id: 'existing-id', username: 'testuser', email: 'other@example.com' });

            await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
            expect(mockUserRepository.save).not.toHaveBeenCalled();
        });

        it('should throw ConflictException if email already exists', async () => {
            mockUserRepository.findOne.mockResolvedValue({ id: 'existing-id', username: 'otheruser', email: 'test@example.com' });

            await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
            expect(mockUserRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('verifyEmail', () => {
        it('should verify email and activate user when OTP matches', async () => {
            const user = {
                id: 'uuid-1',
                username: 'alex',
                email: 'alex@example.com',
                isEmailVerified: false,
                displayName: 'Alex',
                createdAt: new Date(),
            } as User;

            mockUserRepository.findOne.mockResolvedValue(user);
            mockRedisService.get.mockResolvedValue('123456');

            const result = await service.verifyEmail(
                { email: 'alex@example.com', otp: '123456' },
                '10.0.0.1',
                'Chrome',
                'dev-web',
            );

            expect(result.message).toBe('Xác thực email thành công');
            expect(result.accessToken).toBe('mock-jwt-token');
            expect(result.refreshToken).toBe('token-uuid.secret-key');
            expect(result.user).toMatchObject({ email: 'alex@example.com', isEmailVerified: true, twoFactorEnabled: false });
            expect(user.isEmailVerified).toBe(true);
            expect(mockUserRepository.save).toHaveBeenCalledWith(user);
            expect(mockRedisService.del).toHaveBeenCalled();
            // Cấp token qua TokenManager (15 phút + refresh) thay vì token 7 ngày không thu hồi được
            expect(mockTokenManagerService.generateTokenPair).toHaveBeenCalledWith(
                { id: 'uuid-1', username: 'alex' },
                'dev-web',
            );
            expect(mockRedisService.saveSession).toHaveBeenCalledWith(
                'uuid-1',
                'dev-web',
                { ip: '10.0.0.1', userAgent: 'Chrome' },
                2592000,
            );
        });

        it('should count wrong OTP attempts and invalidate the OTP after 5 failures', async () => {
            const user = { id: 'uuid-1', email: 'alex@example.com', isEmailVerified: false } as User;
            mockUserRepository.findOne.mockResolvedValue(user);
            mockRedisService.get.mockImplementation(async (key: string) =>
                key === 'email_verify:alex@example.com' ? '123456' : null,
            );
            mockRedisService.incr.mockResolvedValue(5);

            await expect(service.verifyEmail({ email: 'alex@example.com', otp: '000000' })).rejects.toThrow(
                'Nhập sai mã OTP quá 5 lần',
            );
            expect(mockRedisService.del).toHaveBeenCalledWith(
                'email_verify:alex@example.com',
                'email_verify_attempts:alex@example.com',
            );
        });

        it('should increment the attempt counter on a wrong OTP below the limit', async () => {
            const user = { id: 'uuid-1', email: 'alex@example.com', isEmailVerified: false } as User;
            mockUserRepository.findOne.mockResolvedValue(user);
            mockRedisService.get.mockImplementation(async (key: string) =>
                key === 'email_verify:alex@example.com' ? '123456' : null,
            );

            await expect(service.verifyEmail({ email: 'alex@example.com', otp: '000000' })).rejects.toThrow(
                'Mã OTP không chính xác',
            );
            // Đếm nguyên tử bằng INCR (không read-modify-write)
            expect(mockRedisService.incr).toHaveBeenCalledWith('email_verify_attempts:alex@example.com', 900);
        });

        it('should cap email OTP resends per hour', async () => {
            mockUserRepository.findOne.mockResolvedValue({ id: 'uuid-1', email: 'alex@example.com', isEmailVerified: false });
            mockRedisService.incr.mockResolvedValue(6);

            await expect(service.resendVerification({ email: 'alex@example.com' })).rejects.toThrow('quá nhiều lần');
            expect(mockMailService.sendVerificationEmail).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if OTP expired or invalid', async () => {
            const user = { id: 'uuid-1', email: 'alex@example.com', isEmailVerified: false } as User;
            mockUserRepository.findOne.mockResolvedValue(user);
            mockRedisService.get.mockResolvedValue(null);

            await expect(service.verifyEmail({ email: 'alex@example.com', otp: '123456' })).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('login', () => {
        const loginDto = {
            username: 'testuser',
            password: 'password123',
        };

        it('should successfully login when user email is verified', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            mockUserRepository.findOne.mockResolvedValue({
                id: 'uuid-1234',
                username: 'testuser',
                email: 'test@example.com',
                isEmailVerified: true,
                displayName: 'testuser',
                password: hashedPassword,
                createdAt: new Date('2026-10-05T00:00:00.000Z'),
            });

            const result: any = await service.login(loginDto);

            expect(result).toBeDefined();
            expect(result.accessToken).toBe('mock-jwt-token');
            expect(result.user.username).toBe('testuser');
            expect(result.user.id).toBe('uuid-1234');
        });

        it('should throw ForbiddenException if user email is not yet verified', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            mockUserRepository.findOne.mockResolvedValue({
                id: 'uuid-1234',
                username: 'testuser',
                email: 'test@example.com',
                isEmailVerified: false,
                password: hashedPassword,
            });

            await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
        });

        it('should throw UnauthorizedException if password is wrong', async () => {
            const hashedPassword = await bcrypt.hash('different_password', 10);
            mockUserRepository.findOne.mockResolvedValue({
                id: 'uuid-1234',
                username: 'testuser',
                email: 'test@example.com',
                isEmailVerified: true,
                password: hashedPassword,
            });

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('forgotPassword & resetPassword', () => {
        it('should queue password reset email if user exists', async () => {
            mockUserRepository.findOne.mockResolvedValue({
                id: 'user-1',
                username: 'alex',
                email: 'alex@example.com',
            });

            const result = await service.forgotPassword({ email: 'alex@example.com' });
            expect(result.message).toContain('hướng dẫn đặt lại mật khẩu');
            expect(mockRedisService.set).toHaveBeenCalled();
            expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
                'alex@example.com',
                'alex',
                expect.stringMatching(/^http:\/\/localhost:5173\/reset-password\?token=/),
            );
        });

        it('should reset password successfully when reset token is valid', async () => {
            const user = { id: 'user-1', password: 'old' } as User;
            mockRedisService.get.mockResolvedValue('user-1');
            mockUserRepository.findOne.mockResolvedValue(user);

            const result = await service.resetPassword({
                token: 'valid-token',
                newPassword: 'newSecret@123',
                confirmPassword: 'newSecret@123',
            });

            expect(result.message).toContain('Đặt lại mật khẩu thành công');
            expect(mockUserRepository.save).toHaveBeenCalled();
            expect(mockRedisService.del).toHaveBeenCalledWith('pwd_reset:valid-token');
            expect(mockRedisService.deleteAllUserSessions).toHaveBeenCalledWith('user-1');
            // BR-24: thu hồi thật refresh token của mọi thiết bị + chặn access token cấp trước thời điểm reset
            expect(mockTokenManagerService.revokeAllDevices).toHaveBeenCalledWith('user-1');
            expect(mockRedisService.set).toHaveBeenCalledWith(
                'auth:user_min_issued_at:user-1',
                expect.stringMatching(/^\d{13}$/),
                2592000,
            );
            // H2: ngắt mọi socket đang mở của user
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                AUTH_SESSIONS_REVOKED,
                expect.objectContaining({ userId: 'user-1', scope: { type: 'all' } }),
            );
        });
    });

    describe('Two-Factor Authentication (2FA)', () => {
        it('should initiate 2FA challenge on login when twoFactorEnabled is true', async () => {
            const password = 'Password123@';
            const hashedPassword = await bcrypt.hash(password, 10);
            mockUserRepository.findOne.mockResolvedValue({
                id: 'user-2fa-uuid',
                username: 'alice',
                email: 'alice@example.com',
                isEmailVerified: true,
                twoFactorEnabled: true,
                password: hashedPassword,
            });

            const result: any = await service.login({
                username: 'alice',
                password: 'Password123@',
                deviceId: 'device-iphone-15',
            });

            expect(result.requires2FA).toBe(true);
            expect(result.mfaToken).toBeDefined();
            expect(result.maskedEmail).toBe('a***e@example.com');
            expect(mockRedisService.set).toHaveBeenCalled();
            expect(mockMailService.sendTwoFactorOtpEmail).toHaveBeenCalled();
        });

        it('should successfully verify 2FA login and return access token', async () => {
            const mfaData = {
                userId: 'user-2fa-uuid',
                email: 'alice@example.com',
                username: 'alice',
                otp: '123456',
                attempts: 0,
                deviceId: 'dev-1',
            };
            mockRedisService.get.mockResolvedValue(JSON.stringify(mfaData));
            mockUserRepository.findOne.mockResolvedValue({
                id: 'user-2fa-uuid',
                username: 'alice',
                createdAt: new Date(),
            });

            const result = await service.verify2faLogin({
                mfaToken: 'valid-mfa-token',
                otp: '123456',
            });

            expect(result.accessToken).toBe('mock-jwt-token');
            expect(result.user.username).toBe('alice');
            expect(mockRedisService.del).toHaveBeenCalledWith('mfa_login:valid-mfa-token');
            expect(mockRedisService.saveSession).toHaveBeenCalled();
        });

        it('should throw BadRequestException if 2FA OTP is incorrect', async () => {
            const mfaData = {
                userId: 'user-2fa-uuid',
                email: 'alice@example.com',
                username: 'alice',
                otp: '123456',
                attempts: 0,
            };
            mockRedisService.get.mockResolvedValue(JSON.stringify(mfaData));

            await expect(
                service.verify2faLogin({
                    mfaToken: 'valid-mfa-token',
                    otp: '999999',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should send setup OTP when user requests enabling 2FA', async () => {
            const user = {
                id: 'user-1',
                username: 'alice',
                email: 'alice@example.com',
            } as User;

            const result = await service.send2faSetupOtp(user);
            expect(result.message).toContain('Mã xác thực đã được gửi');
            expect(mockRedisService.set).toHaveBeenCalled();
            expect(mockMailService.sendTwoFactorOtpEmail).toHaveBeenCalledWith(
                'alice@example.com',
                'alice',
                expect.any(String),
                'setup',
            );
        });

        it('should enable 2FA when valid OTP is provided', async () => {
            const user = { id: 'user-1', twoFactorEnabled: false } as User;
            mockRedisService.get.mockResolvedValue('654321');

            const result = await service.enable2fa(user, { otp: '654321' });
            expect(result.message).toContain('kích hoạt thành công');
            expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', { twoFactorEnabled: true });
            expect(mockUserRepository.save).not.toHaveBeenCalled();
            expect(mockRedisService.incr).toHaveBeenCalledWith('2fa_setup_attempts:user-1', 300);
            expect(mockRedisService.del).toHaveBeenCalledWith('2fa_setup:user-1');
        });

        it('should burn the 2FA setup OTP after 5 wrong attempts', async () => {
            mockRedisService.get.mockResolvedValue('654321');
            mockRedisService.incr.mockResolvedValue(5);

            await expect(service.enable2fa({ id: 'user-1' } as User, { otp: '000000' })).rejects.toThrow('quá 5 lần');
            expect(mockRedisService.del).toHaveBeenCalledWith('2fa_setup:user-1', '2fa_setup_attempts:user-1');
            expect(mockUserRepository.update).not.toHaveBeenCalled();
        });

        it('should disable 2FA by re-fetching the password hash (req.user has no password)', async () => {
            const hashedPassword = await bcrypt.hash('CorrectPassword@123', 10);
            const reqUser = { id: 'user-1', twoFactorEnabled: true } as User; // giống JwtStrategy: không có password
            mockUserRepository.findOne.mockResolvedValue({ ...reqUser, password: hashedPassword });

            const result = await service.disable2fa(reqUser, { password: 'CorrectPassword@123' });
            expect(result.message).toContain('Đã tắt tính năng');
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
            expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', { twoFactorEnabled: false });
        });

        it('should reject disabling 2FA with a wrong password', async () => {
            const hashedPassword = await bcrypt.hash('CorrectPassword@123', 10);
            mockUserRepository.findOne.mockResolvedValue({ id: 'user-1', password: hashedPassword });

            await expect(
                service.disable2fa({ id: 'user-1' } as User, { password: 'Wrong@123' }),
            ).rejects.toThrow(UnauthorizedException);
            expect(mockUserRepository.update).not.toHaveBeenCalled();
        });

        it('should keep the failed-attempt counter when resending the 2FA login OTP', async () => {
            const mfaData = { userId: 'u1', email: 'a@x.com', username: 'alice', otp: '111111' };
            mockRedisService.get.mockResolvedValue(JSON.stringify(mfaData));

            await service.resend2faLoginOtp({ mfaToken: 'mfa-1' });

            const saved = JSON.parse(
                mockRedisService.set.mock.calls.find((call: any[]) => call[0] === 'mfa_login:mfa-1')[1],
            );
            expect(saved.resends).toBe(1);
            expect(saved.otp).toMatch(/^\d{6}$/);
            // Bộ đếm lượt sai không bị xóa, chỉ được gia hạn cùng phiên MFA
            expect(mockRedisService.del).not.toHaveBeenCalledWith('mfa_login_attempts:mfa-1');
            expect(mockRedisService.expire).toHaveBeenCalledWith('mfa_login_attempts:mfa-1', 300);
        });

        it('should cancel the 2FA login session after 5 wrong OTPs via the atomic counter', async () => {
            const mfaData = { userId: 'u1', email: 'a@x.com', username: 'alice', otp: '123456' };
            mockRedisService.get.mockResolvedValue(JSON.stringify(mfaData));
            mockRedisService.incr.mockResolvedValue(5);

            await expect(service.verify2faLogin({ mfaToken: 'mfa-1', otp: '999999' })).rejects.toThrow('quá 5 lần');
            expect(mockRedisService.del).toHaveBeenCalledWith('mfa_login:mfa-1', 'mfa_login_attempts:mfa-1');
        });

        it('should refuse resending the 2FA login OTP more than 3 times', async () => {
            const mfaData = { userId: 'u1', email: 'a@x.com', username: 'alice', otp: '111111', attempts: 0, resends: 3 };
            mockRedisService.get.mockResolvedValue(JSON.stringify(mfaData));

            await expect(service.resend2faLoginOtp({ mfaToken: 'mfa-1' })).rejects.toThrow(BadRequestException);
            expect(mockMailService.sendTwoFactorOtpEmail).not.toHaveBeenCalled();
        });
    });

    describe('Multi-Device Session Management & Logout', () => {
        it('should return user sessions with isCurrentDevice flag', async () => {
            mockRedisService.getUserSessions.mockResolvedValue([
                { deviceId: 'dev-1', ip: '127.0.0.1' },
                { deviceId: 'dev-2', ip: '192.168.1.1' },
            ]);

            const sessions = await service.getUserSessions('user-1', 'dev-1');
            expect(sessions).toHaveLength(2);
            expect(sessions[0].isCurrentDevice).toBe(true);
            expect(sessions[1].isCurrentDevice).toBe(false);
        });

        it('should revoke a session and call redisService.deleteSession', async () => {
            const result = await service.revokeSession('user-1', 'dev-2');
            expect(result.message).toContain('Đã kết thúc phiên');
            expect(mockTokenManagerService.revokeDevice).toHaveBeenCalledWith('user-1', 'dev-2');
            expect(mockRedisService.deleteSession).toHaveBeenCalledWith('user-1', 'dev-2');
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                AUTH_SESSIONS_REVOKED,
                expect.objectContaining({ userId: 'user-1', scope: { type: 'devices', deviceIds: ['dev-2'] } }),
            );
        });

        it('should blacklist token and revoke refresh token on logout', async () => {
            const result = await service.logout('user-1', 'my-jwt-token', 'dev-1', 'raw-token.secret');
            expect(result.message).toContain('Đăng xuất thành công');
            expect(mockRedisService.blacklistToken).toHaveBeenCalled();
            expect(mockTokenManagerService.revokeToken).toHaveBeenCalledWith('token-uuid');
            expect(mockTokenManagerService.revokeDevice).toHaveBeenCalledWith('user-1', 'dev-1');
            expect(mockRedisService.deleteSession).toHaveBeenCalledWith('user-1', 'dev-1');
        });
    });

    describe('changePassword', () => {
        const reqUser = { id: 'user-1', username: 'alice' } as User; // không có password như req.user thật
        const validDto = {
            currentPassword: 'OldPass@123',
            newPassword: 'NewPass@456',
            confirmPassword: 'NewPass@456',
        };

        beforeEach(async () => {
            mockUserRepository.findOne.mockResolvedValue({
                id: 'user-1',
                password: await bcrypt.hash('OldPass@123', 10),
            });
        });

        it('should hash and store the new password, then log out every OTHER device', async () => {
            mockTokenManagerService.revokeAllDevices.mockResolvedValue(['dev-2', 'dev-3']);

            const result = await service.changePassword(reqUser, validDto, 'dev-1');

            expect(result.revokedSessions).toBe(2);
            expect(result.message).toContain('Đổi mật khẩu thành công');
            const [userId, patch] = mockUserRepository.update.mock.calls[0];
            expect(userId).toBe('user-1');
            expect(await bcrypt.compare('NewPass@456', patch.password)).toBe(true);
            expect(mockTokenManagerService.revokeAllDevices).toHaveBeenCalledWith('user-1', 'dev-1');
            expect(mockRedisService.deleteSession).toHaveBeenCalledWith('user-1', 'dev-2');
            expect(mockRedisService.deleteSession).toHaveBeenCalledWith('user-1', 'dev-3');
            expect(mockRedisService.deleteSession).not.toHaveBeenCalledWith('user-1', 'dev-1');
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                AUTH_SESSIONS_REVOKED,
                expect.objectContaining({ userId: 'user-1', scope: { type: 'allExcept', deviceId: 'dev-1' } }),
            );
        });

        it('should throw UnauthorizedException when the current password is wrong', async () => {
            const error = await service
                .changePassword(reqUser, { ...validDto, currentPassword: 'Wrong@123' }, 'dev-1')
                .catch((e) => e);
            expect(error).toBeInstanceOf(UnauthorizedException);
            // errorCode giúp FE phân biệt với 401 do token hết hạn (không kích hoạt silent refresh)
            expect(error.getResponse()).toMatchObject({ errorCode: 'INVALID_CURRENT_PASSWORD' });
            expect(mockUserRepository.update).not.toHaveBeenCalled();
            expect(mockTokenManagerService.revokeAllDevices).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when the new password equals the current one', async () => {
            await expect(
                service.changePassword(
                    reqUser,
                    { currentPassword: 'OldPass@123', newPassword: 'OldPass@123', confirmPassword: 'OldPass@123' },
                    'dev-1',
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when confirmation does not match', async () => {
            await expect(
                service.changePassword(reqUser, { ...validDto, confirmPassword: 'Other@456' }, 'dev-1'),
            ).rejects.toThrow('Mật khẩu xác nhận không khớp');
        });

        it('should throw NotFoundException when the user no longer exists', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);
            await expect(service.changePassword(reqUser, validDto, 'dev-1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('refreshTokens', () => {
        it('should rotate tokens and return user profile when user exists', async () => {
            const mockUser = {
                id: 'user-1',
                username: 'alice',
                displayName: 'Alice',
                avatarUrl: null,
                createdAt: new Date(),
            };
            mockUserRepository.findOne.mockResolvedValue(mockUser);

            const result = await service.refreshTokens('valid-token.secret', 'dev-1', '1.2.3.4', 'Firefox');

            expect(mockTokenManagerService.rotateRefreshToken).toHaveBeenCalledWith('valid-token.secret', 'dev-1');
            expect(result).toHaveProperty('accessToken', 'new-jwt-token');
            expect(result).toHaveProperty('refreshToken', 'new-token-uuid.new-secret-key');
            expect(result.user.username).toBe('alice');
            // Profile đầy đủ để FE không mất trạng thái 2FA sau silent refresh
            expect(result.user).toHaveProperty('twoFactorEnabled', false);
            expect(result.user).toHaveProperty('isEmailVerified', false);
            // Gia hạn session theo TTL refresh token (30 ngày)
            expect(mockRedisService.saveSession).toHaveBeenCalledWith(
                'user-1',
                'dev-1',
                { ip: '1.2.3.4', userAgent: 'Firefox' },
                2592000,
            );
        });

        it('should throw UnauthorizedException if user does not exist or was deleted', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);

            await expect(service.refreshTokens('valid-token.secret', 'dev-1')).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });
});
