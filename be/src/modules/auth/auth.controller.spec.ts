import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { User } from '../users/entities/user.entity.js';
import { REFRESH_TOKEN_COOKIE_NAME } from './constants/auth-cookie.constants.js';

describe('AuthController', () => {
    let controller: AuthController;
    let mockAuthService: any;

    beforeEach(async () => {
        mockAuthService = {
            register: vi.fn(),
            verifyEmail: vi.fn(),
            resendVerification: vi.fn(),
            login: vi.fn(),
            verify2faLogin: vi.fn(),
            resend2faLoginOtp: vi.fn(),
            send2faSetupOtp: vi.fn(),
            enable2fa: vi.fn(),
            disable2fa: vi.fn(),
            getUserSessions: vi.fn(),
            revokeSession: vi.fn(),
            forgotPassword: vi.fn(),
            resetPassword: vi.fn(),
            refreshTokens: vi.fn(),
            logout: vi.fn().mockResolvedValue({ message: 'Đăng xuất thành công' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('register', () => {
        it('should call authService.register and return result', async () => {
            const dto: RegisterDto = {
                username: 'alice',
                email: 'alice@example.com',
                password: 'password123',
                confirmPassword: 'password123',
            };
            const mockResponse = {
                accessToken: 'jwt_alice_token',
                user: {
                    id: 'user-1',
                    username: 'alice',
                    createdAt: new Date(),
                },
            };
            mockAuthService.register.mockResolvedValue(mockResponse);

            const result = await controller.register(dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.register).toHaveBeenCalledWith(dto);
        });
    });

    describe('verifyEmail', () => {
        it('should call authService.verifyEmail and return result', async () => {
            const dto = {
                email: 'alice@example.com',
                otp: '123456',
            };
            const mockResponse = {
                message: 'Xác thực tài khoản thành công',
                accessToken: 'jwt_alice_token',
                user: {
                    id: 'user-1',
                    username: 'alice',
                    email: 'alice@example.com',
                },
            };
            mockAuthService.verifyEmail.mockResolvedValue(mockResponse);

            const result = await controller.verifyEmail(dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(dto);
        });
    });

    describe('resendVerification', () => {
        it('should call authService.resendVerification and return result', async () => {
            const dto = { email: 'alice@example.com' };
            const mockResponse = {
                message: 'Mã OTP mới đã được gửi đến email của bạn.',
            };
            mockAuthService.resendVerification.mockResolvedValue(mockResponse);

            const result = await controller.resendVerification(dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.resendVerification).toHaveBeenCalledWith(dto);
        });
    });

    describe('login', () => {
        it('should call authService.login and return result without cookie when no refreshToken', async () => {
            const dto: LoginDto = {
                username: 'alice',
                password: 'password123',
            };
            const mockResponse = {
                accessToken: 'jwt_alice_token',
                user: {
                    id: 'user-1',
                    username: 'alice',
                    createdAt: new Date(),
                },
            };
            mockAuthService.login.mockResolvedValue(mockResponse);

            const result = await controller.login(dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.login).toHaveBeenCalledWith(dto, undefined, undefined, undefined);
        });

        it('should set refresh token cookie and strip it from body when login returns refreshToken', async () => {
            const dto: LoginDto = {
                username: 'alice',
                password: 'password123',
            };
            const mockResponse = {
                accessToken: 'jwt_alice_token',
                refreshToken: 'token-id-123.secret-456',
                user: {
                    id: 'user-1',
                    username: 'alice',
                    createdAt: new Date(),
                },
            };
            mockAuthService.login.mockResolvedValue(mockResponse);

            const mockReq = { ip: '1.2.3.4', headers: { 'user-agent': 'Chrome' } } as any;
            const mockRes = { cookie: vi.fn() } as any;

            const result = await controller.login(dto, mockReq, mockRes, 'dev-1');
            expect(mockAuthService.login).toHaveBeenCalledWith(dto, '1.2.3.4', 'Chrome', 'dev-1');
            expect(mockRes.cookie).toHaveBeenCalledWith(
                REFRESH_TOKEN_COOKIE_NAME,
                'token-id-123.secret-456',
                expect.any(Object),
            );
            expect(result).toEqual({
                accessToken: 'jwt_alice_token',
                user: mockResponse.user,
            });
            expect(result).not.toHaveProperty('refreshToken');
        });
    });

    describe('verify2faLogin', () => {
        it('should call authService.verify2faLogin and set cookie when refreshToken is returned', async () => {
            const dto = { mfaToken: 'token-123', otp: '123456' };
            const mockResponse = {
                accessToken: 'jwt_alice_token',
                refreshToken: 'token-id-123.secret-456',
                user: { id: 'u1', username: 'alice', createdAt: new Date() },
            };
            mockAuthService.verify2faLogin.mockResolvedValue(mockResponse);

            const mockReq = { ip: '1.2.3.4', headers: { 'user-agent': 'Chrome' } } as any;
            const mockRes = { cookie: vi.fn() } as any;

            const result = await controller.verify2faLogin(dto, mockReq, mockRes, 'dev-1');
            expect(mockAuthService.verify2faLogin).toHaveBeenCalledWith(dto, '1.2.3.4', 'Chrome', 'dev-1');
            expect(mockRes.cookie).toHaveBeenCalledWith(
                REFRESH_TOKEN_COOKIE_NAME,
                'token-id-123.secret-456',
                expect.any(Object),
            );
            expect(result).toEqual({
                accessToken: 'jwt_alice_token',
                user: mockResponse.user,
            });
            expect(result).not.toHaveProperty('refreshToken');
        });
    });

    describe('resend2faLoginOtp', () => {
        it('should call authService.resend2faLoginOtp and return result', async () => {
            const dto = { mfaToken: 'token-123' };
            const mockResponse = { message: 'Mã xác thực mới đã được gửi' };
            mockAuthService.resend2faLoginOtp.mockResolvedValue(mockResponse);

            const result = await controller.resend2faLoginOtp(dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.resend2faLoginOtp).toHaveBeenCalledWith(dto);
        });
    });

    describe('send2faSetupOtp', () => {
        it('should call authService.send2faSetupOtp and return result', async () => {
            const user = { id: 'user-1', email: 'alice@example.com' } as User;
            const mockResponse = { message: 'Mã xác thực đã được gửi', maskedEmail: 'a***e@example.com' };
            mockAuthService.send2faSetupOtp.mockResolvedValue(mockResponse);

            const result = await controller.send2faSetupOtp(user);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.send2faSetupOtp).toHaveBeenCalledWith(user);
        });
    });

    describe('enable2fa', () => {
        it('should call authService.enable2fa and return result', async () => {
            const user = { id: 'user-1' } as User;
            const dto = { otp: '123456' };
            const mockResponse = { message: 'Bật 2FA thành công' };
            mockAuthService.enable2fa.mockResolvedValue(mockResponse);

            const result = await controller.enable2fa(user, dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.enable2fa).toHaveBeenCalledWith(user, dto);
        });
    });

    describe('disable2fa', () => {
        it('should call authService.disable2fa and return result', async () => {
            const user = { id: 'user-1' } as User;
            const dto = { password: 'Password123@' };
            const mockResponse = { message: 'Đã tắt 2FA thành công' };
            mockAuthService.disable2fa.mockResolvedValue(mockResponse);

            const result = await controller.disable2fa(user, dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.disable2fa).toHaveBeenCalledWith(user, dto);
        });
    });

    describe('getSessions', () => {
        it('should call authService.getUserSessions and return result', async () => {
            const user = { id: 'user-1' } as User;
            const mockSessions = [{ deviceId: 'dev-1', ip: '127.0.0.1', isCurrentDevice: true }];
            mockAuthService.getUserSessions.mockResolvedValue(mockSessions);

            const result = await controller.getSessions(user, 'dev-1');
            expect(result).toEqual(mockSessions);
            expect(mockAuthService.getUserSessions).toHaveBeenCalledWith('user-1', 'dev-1');
        });
    });

    describe('revokeSession', () => {
        it('should call authService.revokeSession and return result', async () => {
            const user = { id: 'user-1' } as User;
            const mockResponse = { message: 'Đã kết thúc phiên' };
            mockAuthService.revokeSession.mockResolvedValue(mockResponse);

            const result = await controller.revokeSession(user, 'dev-remote');
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.revokeSession).toHaveBeenCalledWith('user-1', 'dev-remote');
        });
    });

    describe('forgotPassword', () => {
        it('should call authService.forgotPassword and return result', async () => {
            const dto = { email: 'alice@example.com' };
            const mockResponse = {
                message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến bạn.',
            };
            mockAuthService.forgotPassword.mockResolvedValue(mockResponse);

            const result = await controller.forgotPassword(dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
        });
    });

    describe('resetPassword', () => {
        it('should call authService.resetPassword and return result', async () => {
            const dto = {
                token: 'reset-token-123',
                newPassword: 'newPassword123',
                confirmPassword: 'newPassword123',
            };
            const mockResponse = {
                message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.',
            };
            mockAuthService.resetPassword.mockResolvedValue(mockResponse);

            const result = await controller.resetPassword(dto);
            expect(result).toEqual(mockResponse);
            expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
        });
    });

    describe('getProfile', () => {
        it('should return the current user object', () => {
            const user = {
                id: 'user-1',
                username: 'alice',
                displayName: 'Alice In Wonderland',
                avatarUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as unknown as User;

            const result = controller.getProfile(user);
            expect(result).toEqual(user);
        });

        it('should have SkipThrottle configured for auth throttler (prevents F5 429 lockout)', () => {
            const isSkipped = Reflect.getMetadata('THROTTLER:SKIPauth', controller.getProfile);
            expect(isSkipped).toBe(true);
        });
    });

    describe('getSessions', () => {
        it('should have SkipThrottle configured for auth throttler', () => {
            const isSkipped = Reflect.getMetadata('THROTTLER:SKIPauth', controller.getSessions);
            expect(isSkipped).toBe(true);
        });
    });

    describe('refresh', () => {
        it('should throw UnauthorizedException if cookie is missing', async () => {
            const mockReq = { cookies: {} } as any;
            const mockRes = { cookie: vi.fn() } as any;

            await expect(controller.refresh(mockReq, mockRes, 'dev-1')).rejects.toThrow(
                'Refresh token không tồn tại trong cookie',
            );
        });

        it('should rotate tokens, set new cookie, and return new access token', async () => {
            const mockReq = { cookies: { [REFRESH_TOKEN_COOKIE_NAME]: 'old-token.secret' } } as any;
            const mockRes = { cookie: vi.fn() } as any;
            const mockRotateResult = {
                accessToken: 'new_jwt_token',
                refreshToken: 'new-token.new-secret',
                user: { id: 'u1', username: 'alice' },
            };
            mockAuthService.refreshTokens.mockResolvedValue(mockRotateResult);

            const result = await controller.refresh(mockReq, mockRes, 'dev-1');

            expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('old-token.secret', 'dev-1');
            expect(mockRes.cookie).toHaveBeenCalledWith(
                REFRESH_TOKEN_COOKIE_NAME,
                'new-token.new-secret',
                expect.any(Object),
            );
            expect(result).toEqual({
                accessToken: 'new_jwt_token',
                user: { id: 'u1', username: 'alice' },
            });
            expect(result).not.toHaveProperty('refreshToken');
        });
    });

    describe('logout', () => {
        it('should return logout success message without cookie', async () => {
            const user = { id: 'user-1' } as User;
            const result = await controller.logout(user);
            expect(result).toEqual({ message: 'Đăng xuất thành công' });
            expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', undefined, undefined, undefined);
        });

        it('should call authService.logout, clear cookie, and return success message when req and res provided', async () => {
            const user = { id: 'user-1' } as User;
            const mockReq = {
                headers: { authorization: 'Bearer access_token_123' },
                cookies: { [REFRESH_TOKEN_COOKIE_NAME]: 'refresh_token_123' },
            } as any;
            const mockRes = { cookie: vi.fn() } as any;

            const result = await controller.logout(user, mockReq, mockRes, 'dev-1');
            expect(result).toEqual({ message: 'Đăng xuất thành công' });
            expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', 'access_token_123', 'dev-1', 'refresh_token_123');
            expect(mockRes.cookie).toHaveBeenCalledWith(
                REFRESH_TOKEN_COOKIE_NAME,
                '',
                expect.any(Object),
            );
        });
    });
});
