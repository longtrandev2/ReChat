import { describe, it, expect, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';

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
                message: 'Database crash',
                path: '/api/v1/unknown',
            }),
        );
    });
});
