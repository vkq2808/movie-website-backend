import { Injectable } from '@nestjs/common';

import nodemailer, { Transporter } from 'nodemailer';

import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService {
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor() {
    // Khởi tạo transporter với thông tin SMTP từ biến môi trường
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.transporter =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      nodemailer.createTransport<SMTPTransport.SentMessageInfo>({
        host: process.env.SMTP_HOST,
        port: Number.parseInt(process.env.SMTP_PORT ?? '465'),
        secure: (process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      } as SMTPTransport.Options);
  }

  // Hàm gửi email OTP
  async sendOtpEmail(to: string, otp: string): Promise<void> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.SMTP_FROM || 'noreply@moviestream.com',
        to,
        subject: 'Mã OTP của bạn',
        text: `Mã OTP của bạn là: ${otp}`,
        html: `<p>Mã OTP của bạn là: <strong>${otp}</strong></p>`,
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.transporter.sendMail(mailOptions);
    } catch {
      // Optionally log error details in a real logger
      throw new Error('Không thể gửi email');
    }
  }
}
