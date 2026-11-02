import { describe, it, expect, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { ArgumentsHost, BadRequestException, HttpStatus, UnauthorizedException } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
    const filter = new AllExceptionsFilter();

    it('should format HttpException properly', () => {
        const jsonMock = vi.fn();
        const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

        const mockHost = {
            switchToHttp: () => ({
                getResponse: () => ({ status: statusMock }),
                getRequest: () => ({ url: '/api/v1/auth/login' }),
            }),
        } as unknown as ArgumentsHost;

        const exception = new BadRequestException('Mật khẩu không hợp lệ');

        filter.catch(exception, mockHost);

        expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                statusCode: HttpStatus.BAD_REQUEST,
                message: 'Mật khẩu không hợp lệ',
                path: '/api/v1/auth/login',
            }),
        );
    });

    it('should forward a machine-readable errorCode when the exception provides one', () => {
        const jsonMock = vi.fn();
        const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
        const mockHost = {
            switchToHttp: () => ({
                getResponse: () => ({ status: statusMock }),
                getRequest: () => ({ url: '/api/v1/auth/change-password' }),
            }),
        } as unknown as ArgumentsHost;

        filter.catch(
            new UnauthorizedException({ errorCode: 'INVALID_CURRENT_PASSWORD', message: 'Sai mật khẩu' }),
            mockHost,
        );

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({ errorCode: 'INVALID_CURRENT_PASSWORD', message: 'Sai mật khẩu' }),
        );
    });

    it('should format standard Error as 500 Internal Server Error', () => {
        const jsonMock = vi.fn();
        const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

        const mockHost = {
            switchToHttp: () => ({
                getResponse: () => ({ status: statusMock }),
                getRequest: () => ({ url: '/api/v1/unknown' }),
            }),
        } as unknown as ArgumentsHost;

        const exception = new Error('Database crash');

        filter.catch(exception, mockHost);

        expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                message: 'Internal server error',
                path: '/api/v1/unknown',
            }),
        );
        // Không lộ thông điệp lỗi thật ra response
        expect(JSON.stringify(jsonMock.mock.calls[0][0])).not.toContain('Database crash');
    });
});
