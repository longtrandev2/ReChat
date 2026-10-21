import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendMailJobData } from './mail.processor.js';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(
        @InjectQueue('mail-queue')
        private readonly mailQueue: Queue<SendMailJobData>,
    ) { }

    async sendVerificationEmail(to: string, username: string, otp: string): Promise<void> {
        this.logger.log(`Queueing verification email for: ${to}`);
        await this.mailQueue.add(
            'send-verify-email',
            {
                type: 'VERIFY_EMAIL',
                to,
                username,
                otp,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    }

    async sendPasswordResetEmail(to: string, username: string, resetLink: string): Promise<void> {
        this.logger.log(`Queueing password reset email for: ${to}`);
        await this.mailQueue.add(
            'send-reset-password',
            {
                type: 'RESET_PASSWORD',
                to,
                username,
                resetLink,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    }

    async sendTwoFactorOtpEmail(
        to: string,
        username: string,
        otp: string,
        action: 'setup' | 'login' = 'login',
    ): Promise<void> {
        this.logger.log(`Queueing 2FA OTP email (${action}) for: ${to}`);
        await this.mailQueue.add(
            'send-2fa-otp',
            {
                type: 'TWO_FACTOR_OTP',
                to,
                username,
                otp,
                action,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    }
}
