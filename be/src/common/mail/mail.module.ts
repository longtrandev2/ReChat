import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service.js';
import { MailProcessor } from './mail.processor.js';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'mail-queue',
        }),
    ],
    providers: [MailService, MailProcessor],
    exports: [MailService],
})
export class MailModule { }
