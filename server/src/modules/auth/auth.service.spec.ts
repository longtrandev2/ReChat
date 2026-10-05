import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
    let service: AuthService;
    let mockUserRepository: any;
    let mockJwtService: any;

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
            password: 'password123',
            confirmPassword: 'password123',
        };

        it('should successfully register a user and return token with profile', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);

            const result = await service.register(registerDto);

            expect(result).toBeDefined();
            expect(result.accessToken).toBe('mock-jwt-token');
            expect(result.user.username).toBe('testuser');
            expect(result.user.displayName).toBe('testuser');
            expect(result.user.id).toBe('uuid-1234');
            expect(mockUserRepository.save).toHaveBeenCalled();
            expect(mockJwtService.signAsync).toHaveBeenCalledWith({
                sub: 'uuid-1234',
                username: 'testuser',
            });
        });

        it('should throw BadRequestException if password does not match confirmPassword', async () => {
            const invalidDto = {
                username: 'testuser',
                password: 'password123',
                confirmPassword: 'mismatch_password',
            };

            await expect(service.register(invalidDto)).rejects.toThrow(BadRequestException);
            expect(mockUserRepository.findOne).not.toHaveBeenCalled();
        });

        it('should throw ConflictException if username already exists', async () => {
            mockUserRepository.findOne.mockResolvedValue({ id: 'existing-id', username: 'testuser' });

            await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
            expect(mockUserRepository.save).not.toHaveBeenCalled();
        });

        it('should throw ConflictException if database throws duplicate key error on save (race condition)', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);
            const duplicateError: any = new Error('Duplicate entry');
            duplicateError.code = 'ER_DUP_ENTRY';
            duplicateError.errno = 1062;
            mockUserRepository.save.mockRejectedValue(duplicateError);

            await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
        });

        it('should rethrow generic database errors on save', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);
            mockUserRepository.save.mockRejectedValue(new Error('DB Connection lost'));

            await expect(service.register(registerDto)).rejects.toThrow('DB Connection lost');
        });
    });

    describe('login', () => {
        const loginDto = {
            username: 'testuser',
            password: 'password123',
        };

        it('should successfully login and return access token and user', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            mockUserRepository.findOne.mockResolvedValue({
                id: 'uuid-1234',
                username: 'testuser',
                displayName: 'testuser',
                password: hashedPassword,
                createdAt: new Date('2026-10-05T00:00:00.000Z'),
            });

            const result = await service.login(loginDto);

            expect(result).toBeDefined();
            expect(result.accessToken).toBe('mock-jwt-token');
            expect(result.user.username).toBe('testuser');
            expect(result.user.id).toBe('uuid-1234');
        });

        it('should throw UnauthorizedException if user does not exist', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if password is wrong', async () => {
            const hashedPassword = await bcrypt.hash('different_password', 10);
            mockUserRepository.findOne.mockResolvedValue({
                id: 'uuid-1234',
                username: 'testuser',
                password: hashedPassword,
                createdAt: new Date(),
            });

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });
    });
});
