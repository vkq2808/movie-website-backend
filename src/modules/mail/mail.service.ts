import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Khởi tạo transporter với thông tin SMTP từ biến môi trường
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // Ví dụ: smtp.gmail.com
      port: parseInt(process.env.SMTP_PORT ?? '465'), // Ví dụ: 587
      auth: {
        user: process.env.SMTP_USER, // Email của bạn
        pass: process.env.SMTP_PASS, // Mật khẩu hoặc app password
      },
    });
  }

  // Hàm gửi email OTP
  async sendOtpEmail(to: string, otp: string): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@moviestream.com',
        to,
        subject: 'Mã OTP của bạn',
        text: `Mã OTP của bạn là: ${otp}`,
        html: `<p>Mã OTP của bạn là: <strong>${otp}</strong></p>`,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.log('error', error);
      throw new Error('Không thể gửi email');
    }
  }
}
