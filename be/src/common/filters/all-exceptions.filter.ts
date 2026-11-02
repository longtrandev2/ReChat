import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error = 'Internal Server Error';
        // Mã lỗi máy-đọc-được (vd: SECURITY_TOKEN_THEFT_DETECTED, INVALID_CURRENT_PASSWORD) cho client phân nhánh xử lý
        let errorCode: string | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();

            if (typeof res === 'string') {
                message = res;
                error = exception.name;
            } else if (typeof res === 'object' && res !== null) {
                const resObj = res as Record<string, any>;
                message = resObj.message || exception.message;
                error = resObj.error || exception.name;
                errorCode = typeof resObj.errorCode === 'string' ? resObj.errorCode : undefined;
            }
        } else if (exception instanceof Error) {
            // Không lộ chi tiết lỗi nội bộ (SQL, stack, đường dẫn) ra response; chỉ ghi log phía server
            this.logger.error(`Unhandled error at ${request?.method} ${request?.url}: ${exception.message}`, exception.stack);
        }

        const errorResponse = {
            success: false,
            statusCode: status,
            message,
            error,
            ...(errorCode ? { errorCode } : {}),
            timestamp: new Date().toISOString(),
            path: request?.url || '',
        };

        response.status(status).json(errorResponse);
    }
}
