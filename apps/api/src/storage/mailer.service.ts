import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.service';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Egyszerű SMTP mailer (dev: MailHog). Fázis 1-ben főleg meghívókhoz/jelszó-reset
 * stubhoz használjuk. Ha az SMTP nem elérhető, NEM dob – csak logol, hogy az
 * üzleti művelet (pl. meghívó létrehozása) ne bukjon meg miatta.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: AppConfigService) {
    const smtp = this.config.smtp;
    this.from = smtp.from;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: false,
      auth:
        smtp.user && smtp.password
          ? { user: smtp.user, pass: smtp.password }
          : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      this.logger.log(`Email elküldve: ${message.to} – ${message.subject}`);
    } catch (err) {
      this.logger.warn(
        `Email küldés sikertelen (${message.to}): ${(err as Error).message}`,
      );
    }
  }
}
