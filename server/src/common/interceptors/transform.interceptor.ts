import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
    success: boolean;
    statusCode: number;
    data: T;
    timestamp: string;
    executionTime?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
        const startTime = Date.now();
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();

        return next.handle().pipe(
            map((data) => {
                // Tránh double-wrapping nếu dữ liệu đã được format sẵn dạng ApiResponse
                if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
                    return data;
                }

                const statusCode = response?.statusCode || 200;
                const executionTime = `${Date.now() - startTime}ms`;

                return {
                    success: true,
                    statusCode,
                    data: data ?? null,
                    timestamp: new Date().toISOString(),
                    executionTime,
                };
            }),
        );
    }
}
