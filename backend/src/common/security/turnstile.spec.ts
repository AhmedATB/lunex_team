import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { RequireTurnstile } from "../decorators/require-turnstile.decorator";
import { TurnstileGuard } from "./turnstile.guard";
import { TurnstileService } from "./turnstile.service";

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

let fetchMock: jest.SpyInstance;
beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, "fetch");
});
afterEach(() => fetchMock.mockRestore());

describe("TurnstileService", () => {
  const on = () => new TurnstileService(config({ TURNSTILE_SECRET_KEY: "secret" }));

  it("asks nothing of anybody, and calls nobody, while no secret is set", async () => {
    const service = new TurnstileService(config({}));
    expect(service.enabled).toBe(false);
    expect(await service.verify("", undefined)).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the token, the secret and the visitor's address to Cloudflare, and accepts a passed check", async () => {
    fetchMock.mockReturnValue(reply({ success: true, action: "login" }));
    expect(await on().verify("tok", "203.0.113.5", "login")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ secret: "secret", response: "tok", remoteip: "203.0.113.5" });
  });

  it("refuses a token Cloudflare rejects (spent, expired, made up)", async () => {
    fetchMock.mockReturnValue(reply({ success: false, "error-codes": ["timeout-or-duplicate"] }));
    expect(await on().verify("tok", "1.2.3.4")).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a token earned on another form, but accepts one with no action recorded", async () => {
    fetchMock.mockReturnValue(reply({ success: true, action: "register" }));
    expect(await on().verify("tok", "1.2.3.4", "login")).toEqual({ ok: false, reason: "wrong_action" });
    fetchMock.mockReturnValue(reply({ success: true, action: "" }));
    expect(await on().verify("tok", "1.2.3.4", "login")).toEqual({ ok: true });
  });

  it("refuses an empty or absurdly long token without asking Cloudflare", async () => {
    expect(await on().verify("", "1.2.3.4")).toEqual({ ok: false, reason: "invalid" });
    expect(await on().verify("x".repeat(3000), "1.2.3.4")).toEqual({ ok: false, reason: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets people through when the check itself cannot be made, so a broken setting never locks the site", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(await on().verify("tok", "1.2.3.4")).toEqual({ ok: true });
    fetchMock.mockReturnValue(reply({}, 502));
    expect(await on().verify("tok", "1.2.3.4")).toEqual({ ok: true });
    fetchMock.mockReturnValue(reply({ success: false, "error-codes": ["invalid-input-secret"] }));
    expect(await on().verify("tok", "1.2.3.4")).toEqual({ ok: true });
  });
});

describe("TurnstileGuard", () => {
  class Handlers {
    @RequireTurnstile("login")
    guarded() {}
    open() {}
  }
  const contextFor = (handler: () => void, headers: Record<string, string> = {}) =>
    ({
      getHandler: () => handler,
      getClass: () => Handlers,
      switchToHttp: () => ({ getRequest: () => ({ header: (name: string) => headers[name], context: { ip: "203.0.113.5" }, ip: "10.0.0.1" }) }),
    }) as unknown as ExecutionContext;
  const build = (verify: jest.Mock, enabled = true) =>
    new TurnstileGuard({ enabled, verify } as unknown as TurnstileService, new Reflector());
  const instance = new Handlers();

  it("leaves an endpoint that does not ask for it alone", async () => {
    const verify = jest.fn();
    expect(await build(verify).canActivate(contextFor(instance.open))).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it("does nothing while Turnstile is not switched on", async () => {
    const verify = jest.fn();
    expect(await build(verify, false).canActivate(contextFor(instance.guarded))).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it("refuses a request with no token", async () => {
    await expect(build(jest.fn()).canActivate(contextFor(instance.guarded))).rejects.toMatchObject({ response: { code: "turnstile_required" }, status: 403 });
  });

  it("checks the token for this form, with the verified client address", async () => {
    const verify = jest.fn(async () => ({ ok: true }));
    expect(await build(verify).canActivate(contextFor(instance.guarded, { "x-turnstile-token": "tok" }))).toBe(true);
    expect(verify).toHaveBeenCalledWith("tok", "203.0.113.5", "login");
  });

  it("refuses a token that does not pass", async () => {
    const verify = jest.fn(async () => ({ ok: false, reason: "invalid" }));
    await expect(build(verify).canActivate(contextFor(instance.guarded, { "x-turnstile-token": "tok" }))).rejects.toMatchObject({ response: { code: "turnstile_failed" }, status: 403 });
  });
});
