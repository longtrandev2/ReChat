import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor.js';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('TransformInterceptor', () => {
    const interceptor = new TransformInterceptor();

    it('should wrap returned controller data into ApiResponse structure', async () => {
        const mockContext = {
            switchToHttp: () => ({
                getResponse: () => ({ statusCode: 200 }),
            }),
        } as unknown as ExecutionContext;

        const mockHandler: CallHandler = {
            handle: () => of({ id: '123', name: 'Alex' }),
        };

        const observable = interceptor.intercept(mockContext, mockHandler);
        observable.subscribe((result) => {
            expect(result.success).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(result.data).toEqual({ id: '123', name: 'Alex' });
            expect(result.timestamp).toBeDefined();
            expect(result.executionTime).toBeDefined();
        });
    });

    it('should handle null data properly', async () => {
        const mockContext = {
            switchToHttp: () => ({
                getResponse: () => ({ statusCode: 204 }),
            }),
        } as unknown as ExecutionContext;

        const mockHandler: CallHandler = {
            handle: () => of(null),
        };

        const observable = interceptor.intercept(mockContext, mockHandler);
        observable.subscribe((result) => {
            expect(result.success).toBe(true);
            expect(result.statusCode).toBe(204);
            expect(result.data).toBeNull();
        });
    });
});
