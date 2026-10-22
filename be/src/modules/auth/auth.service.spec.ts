import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../common/redis/redis.service.js';
import { MailService } from '../../common/mail/mail.service.js';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
    let service: AuthService;
    let mockUserRepository: any;
    let mockJwtService: any;
    let mockRedisService: any;
    let mockMailService: any;

    beforeEach(async () => {
        mockUserRepository = {
            findOne: vi.fn(),
            create: vi.fn((dto) => dto),
            save: vi.fn((user) => Promise.resolve({
                id: 'uuid-1234',
                createdAt: new Date('2026-10-05T00:00:00.000Z'),
                ...user,
            })),
        };

        mockJwtService = {
            signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
        };

        mockRedisService = {
            get: vi.fn(),
            set: vi.fn().mockResolvedValue('OK'),
            del: vi.fn().mockResolvedValue(1),
            exists: vi.fn().mockResolvedValue(0),
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

            const result = await service.verifyEmail({ email: 'alex@example.com', otp: '123456' });

            expect(result.message).toBe('Xác thực email thành công');
            expect(result.accessToken).toBe('mock-jwt-token');
            expect(user.isEmailVerified).toBe(true);
            expect(mockUserRepository.save).toHaveBeenCalledWith(user);
            expect(mockRedisService.del).toHaveBeenCalled();
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
            expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalled();
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
            expect(user.twoFactorEnabled).toBe(true);
            expect(mockUserRepository.save).toHaveBeenCalledWith(user);
            expect(mockRedisService.del).toHaveBeenCalledWith('2fa_setup:user-1');
        });

        it('should disable 2FA when correct password is provided', async () => {
            const hashedPassword = await bcrypt.hash('CorrectPassword@123', 10);
            const user = {
                id: 'user-1',
                twoFactorEnabled: true,
                password: hashedPassword,
            } as User;

            const result = await service.disable2fa(user, { password: 'CorrectPassword@123' });
            expect(result.message).toContain('Đã tắt tính năng');
            expect(user.twoFactorEnabled).toBe(false);
            expect(mockUserRepository.save).toHaveBeenCalledWith(user);
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
            expect(mockRedisService.deleteSession).toHaveBeenCalledWith('user-1', 'dev-2');
        });

        it('should blacklist token and remove device session on logout', async () => {
            const result = await service.logout('user-1', 'my-jwt-token', 'dev-1');
            expect(result.message).toContain('Đăng xuất thành công');
            expect(mockRedisService.blacklistToken).toHaveBeenCalledWith('my-jwt-token', 604800);
            expect(mockRedisService.deleteSession).toHaveBeenCalledWith('user-1', 'dev-1');
        });
    });
});
