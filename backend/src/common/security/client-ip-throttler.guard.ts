import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { RequestContext } from "../middleware/request-context.middleware";

/**
 * The default limiter counts per `req.ip`, which behind our frontend is the frontend itself — so every visitor shared one
 * budget. This counts per visitor instead, but only when the address is verified (it came from our frontend carrying
 * the shared key, see RequestContextMiddleware). A caller that could name its own address would otherwise get a fresh
 * budget by changing it; everyone else keeps the connection's own address, as before.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const context = req.context as RequestContext | undefined;
    return context?.ipVerified ? context.ip : (req.ip as string);
  }
}
