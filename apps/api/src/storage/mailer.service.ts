import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/**
 * Brevo (transactional) mailer a REST API-n keresztül – nincs SDK függőség.
 * Fázis 1-ben meghívókhoz/jelszó-reset-hez. Ha nincs BREVO_API_KEY, NEM dob,
 * csak logol (a tartalmat is dev-ben), hogy az üzleti művelet ne bukjon meg.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: AppConfigService) {}

  async send(message: MailMessage): Promise<void> {
    const { apiKey, sender, from } = this.config.mail;

    if (!apiKey) {
      // Kulcs nélkül (dev/MailHog vagy CI): logoljuk, de nem dobunk.
      this.logger.log(
        `[MAIL stub] -> ${message.to} | ${message.subject}\n${message.text}`,
      );
      return;
    }

    try {
      const res = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: from || sender },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `Brevo email sikertelen (${message.to}): ${res.status} ${body.slice(0, 200)}`,
        );
        return;
      }
      this.logger.log(`Email elküldve (Brevo): ${message.to} – ${message.subject}`);
    } catch (err) {
      this.logger.warn(
        `Brevo email hiba (${message.to}): ${(err as Error).message}`,
      );
    }
  }
}
