import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: Request, res: Response, next: NextFunction) {
        const requestId = (req.headers['x-request-id'] as string) || randomUUID();
        req.headers['x-request-id'] = requestId;
        res.setHeader('X-Request-Id', requestId);

        const startTime = Date.now();
        const { method, originalUrl, ip } = req;

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;
            const message = `[${requestId.slice(0, 8)}] ${method} ${originalUrl} ${statusCode} - ${duration}ms (${ip})`;

            if (statusCode >= 500) {
                this.logger.error(message);
            } else if (statusCode >= 400) {
                this.logger.warn(message);
            } else {
                this.logger.log(message);
            }
        });

        next();
    }
}
