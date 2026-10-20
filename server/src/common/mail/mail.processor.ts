import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { getVerifyEmailTemplate } from './templates/verify-email.template.js';
import { getResetPasswordTemplate } from './templates/reset-password.template.js';
import { getTwoFactorOtpTemplate } from './templates/two-factor-otp.template.js';

export interface SendMailJobData {
    type: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'TWO_FACTOR_OTP';
    to: string;
    username: string;
    otp?: string;
    resetLink?: string;
    action?: 'setup' | 'login';
}

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
    private readonly logger = new Logger(MailProcessor.name);
    private transporter: nodemailer.Transporter | null = null;

    constructor(private readonly configService: ConfigService) {
        super();
        const host = this.configService.get<string>('SMTP_HOST');
        const port = Number(this.configService.get<number>('SMTP_PORT')) || 587;
        const user = this.configService.get<string>('SMTP_USER');
        const pass = this.configService.get<string>('SMTP_PASS');

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
            this.logger.log(`SMTP Mailer initialized using host: ${host}:${port}`);
        } else {
            this.logger.warn('No SMTP credentials configured. Outgoing emails will be logged to console in Dev Mode.');
        }
    }

    async process(job: Job<SendMailJobData>): Promise<void> {
        const { type, to, username, otp, resetLink } = job.data;
        this.logger.log(`Processing email job #${job.id} of type ${type} for recipient: ${to}`);

        let subject = '';
        let html = '';

        if (type === 'VERIFY_EMAIL') {
            subject = 'Mã xác thực kích hoạt tài khoản ReChat';
            html = getVerifyEmailTemplate(username, otp || '');
        } else if (type === 'RESET_PASSWORD') {
            subject = 'Yêu cầu đặt lại mật khẩu ReChat';
            html = getResetPasswordTemplate(username, resetLink || '');
        } else if (type === 'TWO_FACTOR_OTP') {
            subject = job.data.action === 'setup'
                ? 'Xác nhận bật xác thực 2 bước (2FA) ReChat'
                : 'Mã xác thực 2 bước (2FA) đăng nhập ReChat';
            html = getTwoFactorOtpTemplate(username, otp || '', job.data.action || 'login');
        }

        const from = this.configService.get<string>('MAIL_FROM') || '"ReChat Team" <noreply@rechat.app>';

        if (this.transporter) {
            try {
                await this.transporter.sendMail({
                    from,
                    to,
                    subject,
                    html,
                });
                this.logger.log(`Email successfully delivered to ${to} for job #${job.id}`);
            } catch (error: any) {
                this.logger.error(`Failed to send email to ${to}: ${error.message}`);
                throw error; // Ném lỗi để BullMQ kích hoạt cơ chế retry backoff
            }
        } else {
            // Dev Mode fallback: in thông tin ra console
            this.logger.log(`[DEV MODE EMAIL] =================================`);
            this.logger.log(`To: ${to}`);
            this.logger.log(`Subject: ${subject}`);
            if (otp) this.logger.log(`👉 OTP CODE: ${otp}`);
            if (resetLink) this.logger.log(`👉 RESET LINK: ${resetLink}`);
            this.logger.log(`==================================================`);
        }
    }
}
