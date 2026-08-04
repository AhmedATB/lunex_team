import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";

const BLOCKED_UA_PATTERN =
  /python-requests|curl\/|go-http-client|okhttp|libwww-perl|scrapy|headlesschrome|phantomjs|selenium|puppeteer|playwright|\bbot\b|crawler|spider|wget/i;

/**
 * Cheapest possible check, so it runs first among the global guards (see
 * AppModule provider order): most automated scraping traffic never bothers
 * to spoof a realistic User-Agent, which filters a large share of it before
 * any DB or CPU work happens. Deliberately not the only layer — anything
 * determined enough to fake a browser UA still has to clear the proof-of-
 * work challenge (ProofOfWorkGuard) and per-device velocity heuristic
 * (ImagesService) further in.
 */
@Injectable()
export class BotUserAgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ua = request.header("user-agent");
    if (!ua || BLOCKED_UA_PATTERN.test(ua)) {
      throw new HttpException(
        { code: "automated_client_blocked", message: "Automated clients are not permitted." },
        HttpStatus.FORBIDDEN
      );
    }
    return true;
  }
}
