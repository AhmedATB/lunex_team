import { Injectable, NestMiddleware } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface RequestContext {
  requestId: string;
  ip: string;
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

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const rawFingerprint = req.header("x-device-fingerprint") ?? "unknown-device";
    const ip = this.resolveIp(req);

    req.context = {
      requestId: randomUUID(),
      ip,
      deviceFingerprint: createHash("sha256").update(rawFingerprint).digest("hex"),
    };

    res.setHeader("X-Request-Id", req.context.requestId);
    next();
  }

  /** Trusts X-Forwarded-For only because the app sits behind a known reverse proxy/CDN (architecture doc §14/15) — never trust it directly on the open internet. */
  private resolveIp(req: Request): string {
    const forwarded = req.header("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.socket.remoteAddress ?? "unknown";
  }
}
