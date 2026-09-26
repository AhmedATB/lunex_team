import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5_000;
/** Cloudflare documents tokens of up to 2048 characters; anything longer is not one. */
const MAX_TOKEN_LENGTH = 2048;

/** Errors that mean the check itself could not be made (our key, their outage), not that the visitor failed it. */
const UNAVAILABLE_CODES = new Set(["internal-error", "invalid-input-secret", "missing-input-secret"]);

export type TurnstileOutcome = { ok: true } | { ok: false; reason: "invalid" | "wrong_action" };

/**
 * Checks the token a browser earned by passing Cloudflare Turnstile (the "I am not a robot" box) with Cloudflare itself. A token
 * works once and for five minutes, so it cannot be collected and replayed. Switched on by `TURNSTILE_SECRET_KEY`; without it
 * {@link enabled} is false and nothing is asked of anybody.
 *
 * When the check cannot be made at all (Cloudflare unreachable, a wrong secret) it lets the request through and logs it: a
 * broken setting must never lock every member — the owner included — out of signing in. The proof-of-work and the rate limits
 * still stand in front of those endpoints either way.
 */
@Injectable()
export class TurnstileService {
  private readonly log = new Logger(TurnstileService.name);
  private readonly secret?: string;
  private readonly url: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>("TURNSTILE_SECRET_KEY") || undefined;
    // Only ever set to point a test at a local stand-in for Cloudflare.
    this.url = config.get<string>("TURNSTILE_VERIFY_URL") || VERIFY_URL;
  }

  get enabled(): boolean {
    return !!this.secret;
  }

  async verify(token: string, ip: string | undefined, expectedAction?: string): Promise<TurnstileOutcome> {
    if (!this.secret) return { ok: true };
    if (!token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "invalid" };
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: this.secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.log.error(`Turnstile answered ${response.status}; letting the request through`);
        return { ok: true };
      }
      const result = (await response.json()) as { success?: boolean; action?: string; "error-codes"?: string[] };
      if (result.success) {
        return expectedAction && result.action && result.action !== expectedAction ? { ok: false, reason: "wrong_action" } : { ok: true };
      }
      const codes = result["error-codes"] ?? [];
      if (codes.some((code) => UNAVAILABLE_CODES.has(code))) {
        this.log.error(`Turnstile could not check the token (${codes.join(", ")}); letting the request through. Is TURNSTILE_SECRET_KEY right?`);
        return { ok: true };
      }
      return { ok: false, reason: "invalid" };
    } catch (error) {
      this.log.error(`Turnstile could not be reached (${error instanceof Error ? error.message : String(error)}); letting the request through`);
      return { ok: true };
    }
  }
}
