import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 60_000; // 60s — short enough that a leaked/shared URL is worthless within minutes

export interface ImageTokenPayload {
  assetId: string;
  userId: string;
  deviceFingerprint: string;
  expiresAtMs: number;
  nonce: string;
}

export type TokenVerifyResult =
  | { ok: true; payload: ImageTokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "device_mismatch" | "replayed" };

/**
 * Every field that would let a copy-pasted URL work from a different login
 * or a different device is baked into the signed payload itself (architecture
 * doc §9/§10) — verification never trusts anything the caller sends except
 * the token string. A CDN edge function could run this same check with only
 * the HMAC secret, no callback to the auth service needed.
 */
export class ImageTokenSigner {
  constructor(private readonly secret: string) {}

  issue(assetId: string, userId: string, deviceFingerprint: string): string {
    const payload: ImageTokenPayload = {
      assetId,
      userId,
      deviceFingerprint,
      expiresAtMs: Date.now() + TOKEN_TTL_MS,
      nonce: randomBytes(16).toString("base64url"),
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.sign(body);
    return `${body}.${signature}`;
  }

  /** Structural + signature verification only. Expiry/device/replay checks happen in ImagesService, which also owns the nonce cache and audit log. */
  verify(token: string): { ok: true; payload: ImageTokenPayload } | { ok: false; reason: "malformed" | "bad_signature" | "expired" } {
    const parts = token.split(".");
    if (parts.length !== 2) return { ok: false, reason: "malformed" };
    const [body, signature] = parts;

    const expected = this.sign(body);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    // Length check before timingSafeEqual: it throws on mismatched buffer
    // lengths rather than returning false, and the length itself isn't a
    // secret worth constant-time-protecting.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_signature" };
    }

    let payload: ImageTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return { ok: false, reason: "malformed" };
    }
    if (
      typeof payload.assetId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.deviceFingerprint !== "string" ||
      typeof payload.expiresAtMs !== "number" ||
      typeof payload.nonce !== "string"
    ) {
      return { ok: false, reason: "malformed" };
    }
    if (payload.expiresAtMs < Date.now()) {
      return { ok: false, reason: "expired" };
    }

    return { ok: true, payload };
  }

  private sign(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }
}

/**
 * In-memory single-use nonce tracker: a signature-valid, non-expired token
 * that has already been redeemed once is refused on the second use, so
 * capturing a request (e.g. via a proxy tool) and replaying it doesn't grant
 * a second image fetch. Bounded by TTL, so this never grows unbounded.
 *
 * Single-process only — a multi-instance deployment needs this backed by
 * Redis (SETNX with matching TTL) so replay detection holds across
 * instances, same caveat as the in-memory rate limiter in AppModule.
 */
export class NonceCache {
  private readonly seen = new Map<string, number>();

  consume(nonce: string): boolean {
    this.sweep();
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, Date.now() + TOKEN_TTL_MS);
    return true;
  }

  private sweep() {
    const now = Date.now();
    for (const [nonce, expiresAt] of this.seen) {
      if (expiresAt < now) this.seen.delete(nonce);
    }
  }
}
