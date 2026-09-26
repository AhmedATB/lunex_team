import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const RESEND_URL = "https://api.resend.com/emails";
/** A mail provider that hangs must not hang the request that asked for the mail. */
const SEND_TIMEOUT_MS = 8_000;

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * The site's outgoing email, through Resend's HTTP API (no library: one POST). Switched on by `RESEND_API_KEY` (and
 * `MAIL_FROM`, a sender on a domain verified with Resend); without them {@link enabled} is false and nothing is sent — the
 * features that need a mail (password reset) say so honestly instead of pretending, and the site runs unchanged.
 * `send` never throws: a failed mail is logged (without the address) and reported as `false`.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly apiKey?: string;
  private readonly from?: string;
  private readonly url: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("RESEND_API_KEY") || undefined;
    this.from = config.get<string>("MAIL_FROM") || undefined;
    // Only ever set to point a test at a local stand-in for the provider.
    this.url = config.get<string>("RESEND_API_URL") || RESEND_URL;
  }

  get enabled(): boolean {
    return !!this.apiKey && !!this.from;
  }

  async send(mail: OutgoingMail): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.log.warn(`mail provider answered ${response.status}`);
        return false;
      }
      return true;
    } catch (error) {
      this.log.warn(`could not send a mail: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
