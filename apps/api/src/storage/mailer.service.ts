import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

/** Egy e-mail csatolmány (Brevo: base64 tartalom + fájlnév). */
export interface MailAttachment {
  /** Fájlnév (pl. „confidentialitate.pdf"). */
  name: string;
  /** A fájl tartalma base64-ben kódolva. */
  contentBase64: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

/** Egy küldés eredménye (a teszt-küldés ezt jelzi vissza). */
export interface MailSendResult {
  ok: boolean;
  /** Brevo HTTP státusz, ha volt hívás. */
  status?: number;
  /** Hibaüzenet / ok (pl. 'no-api-key'), ha nem sikerült. */
  error?: string;
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/**
 * Brevo (transactional) mailer a REST API-n keresztül – nincs SDK függőség.
 * MINDEN rendszer-email ezen megy (meghívó, jelszó-reset, előfizetés, emlékeztető,
 * riport). Ha nincs BREVO_API_KEY, NEM dob, csak logol, hogy az üzleti művelet
 * ne bukjon meg. A `send` visszaadja a küldés eredményét (a teszt-küldéshez).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: AppConfigService) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const { apiKey, sender, from, fromName } = this.config.mail;
    const fromEmail = from || sender;

    if (!apiKey) {
      // Kulcs nélkül (dev/MailHog vagy CI): csak a címzettet és a tárgyat
      // logoljuk – a törzs jelszó-reset tokent / PII-t tartalmazhat, ezért NEM.
      this.logger.log(`[MAIL stub] -> ${message.to} | ${message.subject}`);
      return { ok: false, error: 'no-api-key' };
    }

    try {
      const res = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        // Ne lógjon be egy lassú upstream a hívót (queue/scheduler) blokkolva.
        signal: AbortSignal.timeout(10_000),
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: fromEmail, name: fromName || 'Valloreg' },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
          attachment: message.attachments?.length
            ? message.attachments.map((a) => ({
                name: a.name,
                content: a.contentBase64,
              }))
            : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const detail = `${res.status} ${body.slice(0, 200)}`;
        this.logger.warn(`Brevo email sikertelen (${message.to}): ${detail}`);
        return { ok: false, status: res.status, error: detail };
      }
      this.logger.log(`Email elküldve (Brevo): ${message.to} – ${message.subject}`);
      return { ok: true, status: res.status };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.warn(`Brevo email hiba (${message.to}): ${error}`);
      return { ok: false, error };
    }
  }
}
