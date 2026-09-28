import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { MailService } from "../mail/mail.service";
import type { NotificationsService } from "../notifications/notifications.service";
import { AuthService } from "./auth.service";
import type { AuthRepository } from "./auth.repository";

const CTX = { ip: "203.0.113.5", deviceFingerprint: "fp" } as unknown as RequestContext;

interface SessionRow {
  id: string;
  userId: string;
  familyId: string;
  revoked: boolean;
  rotatedAt: Date | null;
  expiresAt: Date;
}

const live = (id: string, overrides: Partial<SessionRow> = {}): SessionRow => ({
  id,
  userId: "u1",
  familyId: "f1",
  revoked: false,
  rotatedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
  ...overrides,
});

function build(session: SessionRow | null, options: { familyAlive?: boolean; banned?: boolean } = {}) {
  const repo = {
    findSessionByRefreshHash: jest.fn(async () => session),
    revokeSession: jest.fn(async () => ({})),
    revokeSessionFamily: jest.fn(async () => ({})),
    hasLiveSessionInFamily: jest.fn(async () => options.familyAlive ?? true),
    writeAuditLog: jest.fn(async () => ({})),
    findUserById: jest.fn(async () => ({ id: "u1", role: "reader", isBanned: options.banned ?? false, bannedUntil: null })),
    upsertDevice: jest.fn(async () => ({ device: { id: "d1" }, isNew: false })),
    createSession: jest.fn(async () => ({})),
  };
  const jwt = { signAsync: jest.fn(async () => "access.jwt") };
  const config = { getOrThrow: () => "pepper", get: () => undefined };
  const service = new AuthService(repo as unknown as AuthRepository, jwt as unknown as JwtService, config as unknown as ConfigService, { notify: jest.fn() } as unknown as NotificationsService, {} as unknown as MailService);
  return { service, repo };
}

describe("refreshing a session", () => {
  it("rotates a live token: consumes it (marked as rotated, not logged out) and issues the next one in the same family", async () => {
    const { service, repo } = build(live("s1"));
    const tokens = await service.refresh("raw", CTX);
    expect(tokens.accessToken).toBe("access.jwt");
    expect(tokens.refreshToken).toBeTruthy();
    expect(repo.revokeSession).toHaveBeenCalledWith("s1", true);
    expect(repo.createSession).toHaveBeenCalledWith(expect.objectContaining({ familyId: "f1", userId: "u1" }));
    expect(repo.revokeSessionFamily).not.toHaveBeenCalled();
  });

  it("lets a second request that raced the first one in — a token consumed seconds ago, its family still alive — without ending the session", async () => {
    const { service, repo } = build(live("s1", { revoked: true, rotatedAt: new Date(Date.now() - 2_000) }));
    const tokens = await service.refresh("raw", CTX);
    expect(tokens.refreshToken).toBeTruthy();
    expect(repo.revokeSessionFamily).not.toHaveBeenCalled();
    expect(repo.writeAuditLog).not.toHaveBeenCalled();
    expect(repo.createSession).toHaveBeenCalledWith(expect.objectContaining({ familyId: "f1" }));
    expect(repo.revokeSession).not.toHaveBeenCalled(); // it was consumed already
  });

  it("treats a token consumed a while ago as a replay: the whole family goes, and it is logged", async () => {
    const { service, repo } = build(live("s1", { revoked: true, rotatedAt: new Date(Date.now() - 60_000) }));
    await expect(service.refresh("raw", CTX)).rejects.toMatchObject({ response: { code: "session_reuse_detected" } });
    expect(repo.revokeSessionFamily).toHaveBeenCalledWith("f1");
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "session.reuse_detected" }));
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it("never revives a session that was logged out (no rotation mark), however recently", async () => {
    const { service, repo } = build(live("s1", { revoked: true, rotatedAt: null }));
    await expect(service.refresh("raw", CTX)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.revokeSessionFamily).toHaveBeenCalled();
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it("never revives a family that has ended (logged out or banned after the rotation), even within the window", async () => {
    const { service, repo } = build(live("s1", { revoked: true, rotatedAt: new Date(Date.now() - 2_000) }), { familyAlive: false });
    await expect(service.refresh("raw", CTX)).rejects.toMatchObject({ response: { code: "session_reuse_detected" } });
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it("still refuses a banned account on the racing path, and an expired or unknown token", async () => {
    const banned = build(live("s1", { revoked: true, rotatedAt: new Date(Date.now() - 2_000) }), { banned: true });
    await expect(banned.service.refresh("raw", CTX)).rejects.toMatchObject({ response: { code: "account_banned" } });
    expect(banned.repo.createSession).not.toHaveBeenCalled();

    const expired = build(live("s1", { expiresAt: new Date(Date.now() - 1_000) }));
    await expect(expired.service.refresh("raw", CTX)).rejects.toMatchObject({ response: { code: "refresh_token_expired" } });

    const unknown = build(null);
    await expect(unknown.service.refresh("raw", CTX)).rejects.toMatchObject({ response: { code: "invalid_refresh_token" } });
  });
});
