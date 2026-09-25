import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { ClientIpThrottlerGuard } from "../security/client-ip-throttler.guard";
import { RequestContextMiddleware, type RequestContext } from "./request-context.middleware";

const KEY = "shared-secret-between-the-two-services";

/** Runs the middleware on a fake request and returns the context it attached. */
function contextFor(headers: Record<string, string>, opts: { key?: string; socket?: string } = {}): RequestContext {
  const config = { get: (name: string) => (name === "BFF_SHARED_KEY" ? opts.key : undefined) } as unknown as ConfigService;
  const req = {
    header: (name: string) => headers[name.toLowerCase()],
    socket: { remoteAddress: opts.socket ?? "10.0.0.9" },
  } as unknown as Request;
  const res = { setHeader: jest.fn() } as unknown as Response;
  new RequestContextMiddleware(config).use(req, res, jest.fn());
  return req.context;
}

describe("the visitor's address", () => {
  it("is taken from the frontend when it presents the shared key, and marked verified", () => {
    const ctx = contextFor({ "x-lunex-client-ip": "203.0.113.7", "x-lunex-bff-key": KEY }, { key: KEY });
    expect(ctx).toMatchObject({ ip: "203.0.113.7", ipVerified: true });
  });

  it("accepts an IPv6 address too", () => {
    expect(contextFor({ "x-lunex-client-ip": "2001:db8::1", "x-lunex-bff-key": KEY }, { key: KEY })).toMatchObject({ ip: "2001:db8::1", ipVerified: true });
  });

  it("is ignored without the key, or with a wrong one — nobody else can choose their own address", () => {
    const attempts: Record<string, string>[] = [{ "x-lunex-client-ip": "203.0.113.7" }, { "x-lunex-client-ip": "203.0.113.7", "x-lunex-bff-key": "not-the-key" }];
    for (const headers of attempts) {
      const ctx = contextFor(headers, { key: KEY, socket: "198.51.100.4" });
      expect(ctx).toMatchObject({ ip: "198.51.100.4", ipVerified: false });
    }
  });

  it("is ignored when no key is configured at all (the old behaviour, so a deploy without the setting changes nothing)", () => {
    const ctx = contextFor({ "x-lunex-client-ip": "203.0.113.7", "x-lunex-bff-key": KEY }, { socket: "198.51.100.4" });
    expect(ctx).toMatchObject({ ip: "198.51.100.4", ipVerified: false });
  });

  it("is ignored when it is not an address, even with the right key", () => {
    for (const claimed of ["not-an-ip", "1.2.3.4, 5.6.7.8", "999.1.1.1", ""]) {
      expect(contextFor({ "x-lunex-client-ip": claimed, "x-lunex-bff-key": KEY }, { key: KEY, socket: "198.51.100.4" }).ipVerified).toBe(false);
    }
  });

  it("falls back to X-Forwarded-For, unverified, as before", () => {
    expect(contextFor({ "x-forwarded-for": "192.0.2.10, 10.1.1.1" })).toMatchObject({ ip: "192.0.2.10", ipVerified: false });
  });
});

describe("what the rate limiter counts", () => {
  const guard = Object.create(ClientIpThrottlerGuard.prototype) as { getTracker(req: Record<string, unknown>): Promise<string> };

  it("counts a verified visitor by their own address", async () => {
    expect(await guard.getTracker({ ip: "10.0.0.9", context: { ip: "203.0.113.7", ipVerified: true } })).toBe("203.0.113.7");
  });

  it("keeps counting anyone else by the connection's address, whatever they claim", async () => {
    expect(await guard.getTracker({ ip: "10.0.0.9", context: { ip: "203.0.113.7", ipVerified: false } })).toBe("10.0.0.9");
    expect(await guard.getTracker({ ip: "10.0.0.9" })).toBe("10.0.0.9");
  });
});
