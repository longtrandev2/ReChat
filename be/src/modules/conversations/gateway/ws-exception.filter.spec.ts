import { describe, it, expect, vi } from 'vitest';
import { ArgumentsHost, BadRequestException, ForbiddenException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsExceptionsFilter } from './ws-exception.filter.js';

const run = (exception: unknown) => {
    const emit = vi.fn();
    const host = { switchToWs: () => ({ getClient: () => ({ emit }) }) } as unknown as ArgumentsHost;
    new WsExceptionsFilter().catch(exception, host);
    return emit.mock.calls[0];
};

describe('WsExceptionsFilter', () => {
    it('includes errorCode from HttpException response (CONVERSATION_BLOCKED)', () => {
        const [event, payload] = run(
            new ForbiddenException({ errorCode: 'CONVERSATION_BLOCKED', message: 'Bạn đã chặn người dùng này' }),
        );
        expect(event).toBe('exception');
        expect(payload).toMatchObject({
            status: 'error',
            message: 'Bạn đã chặn người dùng này',
            errorCode: 'CONVERSATION_BLOCKED',
        });
        expect(payload.timestamp).toBeDefined();
    });

    it('omits errorCode when the exception has none', () => {
        const [, payload] = run(new BadRequestException('bad'));
        expect(payload.message).toBe('bad');
        expect(payload).not.toHaveProperty('errorCode');
    });

    it('handles WsException', () => {
        const [, payload] = run(new WsException('Unauthorized'));
        expect(payload.message).toBe('Unauthorized');
        expect(payload).not.toHaveProperty('errorCode');
    });
});
