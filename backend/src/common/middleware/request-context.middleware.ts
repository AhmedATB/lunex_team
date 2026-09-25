import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { NextFunction, Request, Response } from "express";

export interface RequestContext {
  requestId: string;
  ip: string;
  /**
   * True only when `ip` was vouched for by our own frontend (it presented the shared BFF key) — the one case where it
   * is the real visitor's address and cannot have been chosen by the caller. Rate limiting keys on it only then.
   */
  ipVerified: boolean;
  /**
   * Real device fingerprinting (canvas/WebGL/audio hash) is a frontend
   * concern — the client computes it and sends it as a header. The backend
   * only ever hashes and compares opaque values; it never trusts the client
   * on WHAT the fingerprint claims to be, only on it being consistent across
   * requests from the same device.
   */
  deviceFingerprint: string;
}

declare module "express-serve-static-core" {
  interface Request {
    context: RequestContext;
  }
}

/** Constant-time comparison of two secrets (hashed first, so their lengths do not leak). */
function sameSecret(a: string | undefined, b: string): boolean {
  if (!a) return false;
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const rawFingerprint = req.header("x-device-fingerprint") ?? "unknown-device";
    const { ip, verified } = this.resolveIp(req);

    req.context = {
      requestId: randomUUID(),
      ip,
      ipVerified: verified,
      deviceFingerprint: createHash("sha256").update(rawFingerprint).digest("hex"),
    };

    res.setHeader("X-Request-Id", req.context.requestId);
    next();
  }

  /**
   * The visitor's address, as far as it can be known.
   *
   * Every browser request reaches this service through our own frontend (the BFF, §1), so the socket and Railway's
   * forwarded header both name the frontend, not the visitor. The frontend therefore sends the address it saw in
   * `x-lunex-client-ip`, together with a secret shared by the two services (`BFF_SHARED_KEY`). With the right secret the
   * address is taken as the real one (`verified`); without it the header is ignored, so nobody else can pick their own.
   *
   * Anything else falls back to the old behaviour: `X-Forwarded-For` (trusted only because a proxy sits in front, §14/15),
   * unverified — good enough for an audit log, not for rate limiting.
   */
  private resolveIp(req: Request): { ip: string; verified: boolean } {
    const key = this.config.get<string>("BFF_SHARED_KEY");
    const claimed = req.header("x-lunex-client-ip")?.trim();
    if (key && claimed && isIP(claimed) !== 0 && sameSecret(req.header("x-lunex-bff-key"), key)) {
      return { ip: claimed, verified: true };
    }

    const forwarded = req.header("x-forwarded-for");
    if (forwarded) return { ip: forwarded.split(",")[0].trim(), verified: false };
    return { ip: req.socket.remoteAddress ?? "unknown", verified: false };
  }
}
