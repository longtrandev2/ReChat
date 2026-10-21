import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
    protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
        // Chỉ áp dụng Rate Limit cho HTTP, bỏ qua WebSocket (ChatGateway)
        if (context.getType() !== 'http') {
            return true;
        }
        return false;
    }
}
