import { Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException, HttpException, Error)
export class WsExceptionsFilter extends BaseWsExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const client = host.switchToWs().getClient<Socket>();
        let message = 'Internal WebSocket server error';

        if (exception instanceof WsException) {
            const error = exception.getError();
            message = typeof error === 'string' ? error : (error as any)?.message || JSON.stringify(error);
        } else if (exception instanceof HttpException) {
            const res = exception.getResponse();
            message = typeof res === 'string' ? res : (res as any)?.message || exception.message;
            if (Array.isArray(message)) {
                message = message.join(', ');
            }
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        // Emit event chuẩn hóa 'exception' về đúng client gây ra lỗi (BR-11, SPEC Section 6.2, Section 8)
        client.emit('exception', {
            status: 'error',
            message,
            timestamp: new Date().toISOString(),
        });
    }
}
