import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { MailService, OutgoingMail } from "../mail/mail.service";
import type { NotificationsService } from "../notifications/notifications.service";
import { AuthService } from "./auth.service";
import type { AuthRepository } from "./auth.repository";

const CTX = { ip: "203.0.113.5" } as RequestContext;
const flush = () => new Promise((resolve) => setImmediate(resolve));

interface ResetRow { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; createdAt: Date }

function build(options: { mailEnabled?: boolean; mailWorks?: boolean; users?: Record<string, unknown>[] } = {}) {
  const users = options.users ?? [{ id: "u1", email: "qays@example.com", passwordHash: "hash", isBanned: false, bannedUntil: null }];
  const resets: ResetRow[] = [];
  const sent: OutgoingMail[] = [];
  const repo = {
    findUserByEmail: jest.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
    findUserById: jest.fn(async (id: string) => users.find((u) => u.id === id) ?? null),
    latestPasswordReset: jest.fn(async (userId: string) => {
      const mine = resets.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return mine[0] ? { createdAt: mine[0].createdAt } : null;
    }),
    replacePasswordReset: jest.fn(async (userId: string, tokenHash: string, expiresAt: Date) => {
      for (let i = resets.length - 1; i >= 0; i--) if (resets[i].userId === userId) resets.splice(i, 1);
      resets.push({ id: `r${resets.length + 1}`, userId, tokenHash, expiresAt, usedAt: null, createdAt: new Date() });
    }),
    findPasswordReset: jest.fn(async (tokenHash: string) => resets.find((r) => r.tokenHash === tokenHash) ?? null),
    claimPasswordReset: jest.fn(async (id: string) => {
      const row = resets.find((r) => r.id === id);
      if (!row || row.usedAt) return false;
      row.usedAt = new Date();
      return true;
    }),
    deletePasswordResetByHash: jest.fn(async (tokenHash: string) => {
      const i = resets.findIndex((r) => r.tokenHash === tokenHash);
      if (i >= 0) resets.splice(i, 1);
    }),
    deletePasswordResetsForUser: jest.fn(async (userId: string) => {
      for (let i = resets.length - 1; i >= 0; i--) if (resets[i].userId === userId) resets.splice(i, 1);
    }),
    updatePassword: jest.fn(async () => ({})),
    revokeAllSessionsForUser: jest.fn(async () => ({})),
    writeAuditLog: jest.fn(async () => ({})),
  };
  const mail = {
    enabled: options.mailEnabled ?? true,
    send: jest.fn(async (m: OutgoingMail) => {
      sent.push(m);
      return options.mailWorks ?? true;
    }),
  };
  const notifications = { notify: jest.fn(async () => ({})) };
  const config = { getOrThrow: () => "pepper", get: (key: string) => (key === "FRONTEND_URL" ? "https://lunexteam.com/" : undefined) };
  const service = new AuthService(repo as unknown as AuthRepository, {} as JwtService, config as unknown as ConfigService, notifications as unknown as NotificationsService, mail as unknown as MailService);
  const tokenIn = (mail: OutgoingMail) => /#token=([\w-]+)/.exec(mail.text)![1];
  return { service, repo, mail, sent, resets, notifications, tokenIn };
}

describe("asking for a reset link", () => {
  it("mails a link with a token in the fragment, and stores only a hash of it", async () => {
    const { service, sent, resets, tokenIn } = build();
    expect(await service.requestPasswordReset("qays@example.com", CTX)).toEqual({ available: true });
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("qays@example.com");
    expect(sent[0].text).toContain("https://lunexteam.com/reset-password#token=");
    expect(sent[0].html).toContain("https://lunexteam.com/reset-password#token=");
    const token = tokenIn(sent[0]);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(resets).toHaveLength(1);
    expect(resets[0].tokenHash).not.toContain(token);
    expect(resets[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
    expect(resets[0].expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 61 * 60 * 1000);
  });

  it("answers the same for an address that has no account, and sends nothing", async () => {
    const { service, sent } = build();
    expect(await service.requestPasswordReset("nobody@example.com", CTX)).toEqual({ available: true });
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("sends nothing to a Discord/Google-only account or a banned one, and still answers the same", async () => {
    const { service, sent } = build({
      users: [
        { id: "o", email: "oauth@example.com", passwordHash: null, isBanned: false, bannedUntil: null },
        { id: "b", email: "banned@example.com", passwordHash: "h", isBanned: true, bannedUntil: null },
      ],
    });
    expect(await service.requestPasswordReset("oauth@example.com", CTX)).toEqual({ available: true });
    expect(await service.requestPasswordReset("banned@example.com", CTX)).toEqual({ available: true });
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("says plainly that it is unavailable while the site has no mail provider, and does nothing else", async () => {
    const { service, repo, sent } = build({ mailEnabled: false });
    expect(await service.requestPasswordReset("qays@example.com", CTX)).toEqual({ available: false });
    expect(repo.replacePasswordReset).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it("sends one mail for two asks in a row", async () => {
    const { service, sent } = build();
    await service.requestPasswordReset("qays@example.com", CTX);
    await service.requestPasswordReset("qays@example.com", CTX);
    await flush();
    expect(sent).toHaveLength(1);
  });

  it("drops the link again when the mail did not go out, so the person can simply ask again", async () => {
    const { service, resets } = build({ mailWorks: false });
    await service.requestPasswordReset("qays@example.com", CTX);
    await flush();
    expect(resets).toHaveLength(0);
    await service.requestPasswordReset("qays@example.com", CTX);
    await flush();
    expect(resets).toHaveLength(0); // no cooldown left over from the failed one: it tried again
  });
});

describe("using a reset link", () => {
  async function issued() {
    const ctx = build();
    await ctx.service.requestPasswordReset("qays@example.com", CTX);
    await flush();
    return { ...ctx, token: ctx.tokenIn(ctx.sent[0]) };
  }

  it("sets the new password, signs every device out and tells the account", async () => {
    const { service, repo, notifications, token } = await issued();
    await service.resetPassword(token, "a-brand-new-password", CTX);
    expect(repo.updatePassword).toHaveBeenCalledWith("u1", expect.stringMatching(/^\$argon2/));
    expect(repo.revokeAllSessionsForUser).toHaveBeenCalledWith("u1");
    expect(repo.deletePasswordResetsForUser).toHaveBeenCalledWith("u1");
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "user.password_reset" }));
    expect(notifications.notify).toHaveBeenCalledWith("u1", "security", expect.any(String), expect.any(String));
  });

  it("works once: the same link a second time is refused", async () => {
    const { service, resets, token } = await issued();
    await service.resetPassword(token, "a-brand-new-password", CTX);
    expect(resets).toHaveLength(0);
    await expect(service.resetPassword(token, "another-new-password", CTX)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a made-up token, an expired one and one already used", async () => {
    const { service, resets, token } = await issued();
    await expect(service.resetPassword("x".repeat(43), "a-brand-new-password", CTX)).rejects.toMatchObject({ response: { code: "reset_link_invalid" } });
    resets[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.resetPassword(token, "a-brand-new-password", CTX)).rejects.toBeInstanceOf(BadRequestException);
    resets[0].expiresAt = new Date(Date.now() + 60_000);
    resets[0].usedAt = new Date();
    await expect(service.resetPassword(token, "a-brand-new-password", CTX)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not change anything when somebody else spent the link a moment earlier", async () => {
    const { service, repo, token } = await issued();
    repo.claimPasswordReset.mockResolvedValueOnce(false);
    await expect(service.resetPassword(token, "a-brand-new-password", CTX)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updatePassword).not.toHaveBeenCalled();
  });
});
