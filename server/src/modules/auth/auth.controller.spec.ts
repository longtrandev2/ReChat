import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { User } from '../users/entities/user.entity.js';

describe('AuthController', () => {
    let controller: AuthController;
    let mockAuthService: any;

    beforeEach(async () => {
        mockAuthService = {
            register: vi.fn(),
            login: vi.fn(),
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

    describe('login', () => {
        it('should call authService.login and return result', async () => {
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
            expect(mockAuthService.login).toHaveBeenCalledWith(dto);
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
    });

    describe('logout', () => {
        it('should return logout success message', () => {
            const result = controller.logout();
            expect(result).toEqual({ message: 'Đăng xuất thành công' });
        });
    });
});
