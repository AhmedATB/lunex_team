import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

const CHALLENGE_TTL_MS = 2 * 60_000; // 2 minutes to solve and redeem
const DIFFICULTY = 4; // required leading hex zeros — near-instant on real hardware, meaningfully costly at bot/script scale

export interface VerifyResult {
  ok: boolean;
  reason?: "unknown_or_redeemed_challenge" | "challenge_expired" | "insufficient_work";
}

/**
 * A registration/login/image-token request costs the server almost nothing
 * to reject or accept on its own — that asymmetry is exactly what lets
 * credential-stuffing and mass-scraping scripts hit an endpoint thousands of
 * times a minute cheaply. Proof-of-work flips that: the CLIENT now has to
 * spend real CPU time per request, which costs a legitimate single human
 * nothing noticeable but makes scripted bulk abuse expensive at scale.
 *
 * In-memory challenge store, single-process only — same caveat as the
 * rate limiter and image-token nonce cache: a multi-instance deployment
 * needs this backed by Redis so a challenge solved against one instance
 * can't be replayed against another.
 */
@Injectable()
export class ProofOfWorkService {
  private readonly issued = new Map<string, number>(); // nonce -> expiresAtMs

  issue(): { nonce: string; difficulty: number; expiresIn: number } {
    this.sweep();
    const nonce = randomBytes(16).toString("base64url");
    this.issued.set(nonce, Date.now() + CHALLENGE_TTL_MS);
    return { nonce, difficulty: DIFFICULTY, expiresIn: CHALLENGE_TTL_MS / 1000 };
  }

  /** Single-use: a solved challenge is deleted on successful verification so it can't be replayed across multiple protected requests. */
  verify(nonce: string, solution: string): VerifyResult {
    this.sweep();
    const expiresAtMs = this.issued.get(nonce);
    if (!expiresAtMs) return { ok: false, reason: "unknown_or_redeemed_challenge" };
    if (expiresAtMs < Date.now()) {
      this.issued.delete(nonce);
      return { ok: false, reason: "challenge_expired" };
    }

    const hash = createHash("sha256").update(`${nonce}:${solution}`).digest("hex");
    if (!hash.startsWith("0".repeat(DIFFICULTY))) {
      return { ok: false, reason: "insufficient_work" };
    }

    this.issued.delete(nonce);
    return { ok: true };
  }

  private sweep() {
    const now = Date.now();
    for (const [nonce, expiresAtMs] of this.issued) {
      if (expiresAtMs < now) this.issued.delete(nonce);
    }
  }
}
