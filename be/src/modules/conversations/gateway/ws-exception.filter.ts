import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException, HttpException, Error)
export class WsExceptionsFilter extends BaseWsExceptionFilter {
    private readonly logger = new Logger(WsExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const client = host.switchToWs().getClient<Socket>();
        let message = 'Internal WebSocket server error';
        // Mã lỗi máy-đọc-được (vd: CONVERSATION_BLOCKED) để client phân nhánh UI
        let errorCode: string | undefined;

        if (exception instanceof WsException) {
            const error = exception.getError();
            message = typeof error === 'string' ? error : (error as any)?.message || JSON.stringify(error);
        } else if (exception instanceof HttpException) {
            const res = exception.getResponse();
            message = typeof res === 'string' ? res : (res as any)?.message || exception.message;
            const code = typeof res === 'object' && res !== null ? (res as any).errorCode : undefined;
            if (typeof code === 'string') errorCode = code;
            if (Array.isArray(message)) {
                message = message.join(', ');
            }
        } else if (exception instanceof Error) {
            // Lỗi không lường trước (DB, bug...): không lộ chi tiết nội bộ cho client, chỉ ghi log phía server
            this.logger.error(`Unhandled WebSocket error: ${exception.message}`, exception.stack);
        }

        // Emit event chuẩn hóa 'exception' về đúng client gây ra lỗi (BR-11, SPEC Section 6.2, Section 8)
        client.emit('exception', {
            status: 'error',
            message,
            ...(errorCode ? { errorCode } : {}),
            timestamp: new Date().toISOString(),
        });
    }
}
