import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { NotificationsService } from "../notifications/notifications.service";
import type { ModerationRepository } from "./moderation.repository";
import { ModerationService } from "./moderation.service";
import { activeBannedUntil, activeMutedUntil, isEffectivelyBanned, isMuted } from "./moderation.util";

const CTX = { ip: "203.0.113.9" } as RequestContext;
const HOUR = 60 * 60 * 1000;

describe("moderation.util", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const later = new Date(now.getTime() + HOUR);
  const earlier = new Date(now.getTime() - HOUR);

  it("treats a ban with no end date as permanent", () => {
    expect(isEffectivelyBanned({ isBanned: true, bannedUntil: null }, now)).toBe(true);
  });

  it("lets a temporary ban expire without any job running", () => {
    expect(isEffectivelyBanned({ isBanned: true, bannedUntil: later }, now)).toBe(true);
    expect(isEffectivelyBanned({ isBanned: true, bannedUntil: earlier }, now)).toBe(false);
  });

  it("ignores bannedUntil when the account is not flagged banned", () => {
    expect(isEffectivelyBanned({ isBanned: false, bannedUntil: later }, now)).toBe(false);
  });

  it("only reports a timeout while it is running", () => {
    expect(isMuted({ mutedUntil: later }, now)).toBe(true);
    expect(isMuted({ mutedUntil: earlier }, now)).toBe(false);
    expect(isMuted({ mutedUntil: null }, now)).toBe(false);
    expect(activeMutedUntil({ mutedUntil: later }, now)).toBe(later.toISOString());
    expect(activeMutedUntil({ mutedUntil: earlier }, now)).toBeNull();
  });

  it("reports an end date only for a temporary ban that is running", () => {
    expect(activeBannedUntil({ isBanned: true, bannedUntil: later }, now)).toBe(later.toISOString());
    expect(activeBannedUntil({ isBanned: true, bannedUntil: null }, now)).toBeNull();
    expect(activeBannedUntil({ isBanned: true, bannedUntil: earlier }, now)).toBeNull();
  });
});

interface UserRow {
  id: string;
  username: string;
  role: string;
  isBanned: boolean;
  bannedUntil: Date | null;
  mutedUntil: Date | null;
}

const user = (id: string, role: string, overrides: Partial<UserRow> = {}): UserRow => ({
  id,
  username: id,
  role,
  isBanned: false,
  bannedUntil: null,
  mutedUntil: null,
  ...overrides,
});

function build(users: UserRow[]) {
  const byId = new Map(users.map((u) => [u.id, u]));
  const sanctionRow = { id: "s1", type: "timeout", reason: "spam", createdById: "actor", createdAt: new Date(), expiresAt: null, revokedAt: null, revokedById: null };
  const repo = {
    findUser: jest.fn(async (id: string) => byId.get(id) ?? null),
    createWarning: jest.fn(async (_params: unknown) => ({ ...sanctionRow, type: "warning" })),
    createTimeout: jest.fn(async (_params: unknown) => sanctionRow),
    createBan: jest.fn(async (_params: unknown) => ({ ...sanctionRow, type: "ban" })),
    liftTimeout: jest.fn().mockResolvedValue(undefined),
    liftBan: jest.fn().mockResolvedValue(undefined),
    retractWarning: jest.fn().mockResolvedValue(undefined),
    findSanction: jest.fn(),
    listSanctions: jest.fn().mockResolvedValue([]),
    findUsernames: jest.fn().mockResolvedValue(new Map()),
    clearProfileParts: jest.fn().mockResolvedValue(undefined),
    recordAction: jest.fn(async (_params: unknown) => ({ id: "rec1" })),
    revokeAllSessions: jest.fn().mockResolvedValue({ count: 2 }),
    removeAllComments: jest.fn().mockResolvedValue(3),
    accountInfo: jest.fn().mockResolvedValue({ email: "person@example.com", comments: 3 }),
    writeAuditLog: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ModerationService(repo as unknown as ModerationRepository, notifications as unknown as NotificationsService);
  return { service, repo, notifications };
}

const roster = () => [
  user("owner", "owner"),
  user("admin", "super_administrator"),
  user("mod", "moderator"),
  user("mod2", "moderator"),
  user("editor", "editor"),
  user("reader", "reader"),
];

const timeout = { type: "timeout", reason: "spamming", durationHours: 24 };

describe("ModerationService.applySanction: who may act", () => {
  it("lets a moderator time out and warn an ordinary member", async () => {
    const { service, repo } = build(roster());
    await service.applySanction("mod", "reader", timeout, CTX);
    await service.applySanction("mod", "reader", { type: "warning", reason: "please be civil" }, CTX);
    expect(repo.createTimeout).toHaveBeenCalledTimes(1);
    expect(repo.createWarning).toHaveBeenCalledTimes(1);
  });

  it("does not let a moderator ban", async () => {
    const { service, repo } = build(roster());
    await expect(service.applySanction("mod", "reader", { type: "ban", reason: "no" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.createBan).not.toHaveBeenCalled();
  });

  it("lets an administrator ban, temporarily or permanently", async () => {
    const { service, repo } = build(roster());
    await service.applySanction("admin", "reader", { type: "ban", reason: "abuse", durationHours: 72 }, CTX);
    await service.applySanction("admin", "editor", { type: "ban", reason: "abuse" }, CTX);
    expect(repo.createBan).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: "reader", expiresAt: expect.any(Date) }));
    expect(repo.createBan).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: "editor", expiresAt: null }));
  });

  it("refuses anyone who is not staff", async () => {
    const { service } = build(roster());
    for (const actor of ["reader", "editor"]) {
      await expect(service.applySanction(actor, "reader", timeout, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it("refuses a self-sanction, the owner, and anyone of equal or higher rank", async () => {
    const { service, repo } = build(roster());
    await expect(service.applySanction("mod", "mod", timeout, CTX)).rejects.toMatchObject({ response: { code: "cannot_sanction_self" } });
    await expect(service.applySanction("admin", "owner", timeout, CTX)).rejects.toMatchObject({ response: { code: "cannot_sanction_owner" } });
    await expect(service.applySanction("mod", "mod2", timeout, CTX)).rejects.toMatchObject({ response: { code: "cannot_sanction_equal_or_higher" } });
    await expect(service.applySanction("mod", "admin", timeout, CTX)).rejects.toMatchObject({ response: { code: "cannot_sanction_equal_or_higher" } });
    expect(repo.createTimeout).not.toHaveBeenCalled();
  });

  it("lets a higher rank act on a moderator", async () => {
    const { service, repo } = build(roster());
    await service.applySanction("admin", "mod", timeout, CTX);
    expect(repo.createTimeout).toHaveBeenCalled();
  });

  it("404s an unknown target", async () => {
    const { service } = build(roster());
    await expect(service.applySanction("mod", "ghost", timeout, CTX)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ModerationService.applySanction: rules", () => {
  it("requires a duration for a timeout and forbids one on a warning", async () => {
    const { service } = build(roster());
    await expect(service.applySanction("mod", "reader", { type: "timeout", reason: "spam" }, CTX)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.applySanction("mod", "reader", { type: "warning", reason: "spam", durationHours: 5 }, CTX)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("caps a moderator's timeout at 30 days but not an administrator's", async () => {
    const { service, repo } = build(roster());
    await expect(service.applySanction("mod", "reader", { ...timeout, durationHours: 24 * 30 + 1 }, CTX)).rejects.toMatchObject({
      response: { code: "duration_too_long" },
    });
    await service.applySanction("mod", "reader", { ...timeout, durationHours: 24 * 30 }, CTX);
    await service.applySanction("admin", "reader", { ...timeout, durationHours: 24 * 200 }, CTX);
    expect(repo.createTimeout).toHaveBeenCalledTimes(2);
  });

  it("sets the timeout end from the requested duration", async () => {
    const { service, repo } = build(roster());
    const before = Date.now();
    await service.applySanction("mod", "reader", { ...timeout, durationHours: 2 }, CTX);
    const { expiresAt } = repo.createTimeout.mock.calls[0][0] as { expiresAt: Date };
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 2 * HOUR);
    expect(expiresAt.getTime()).toBeLessThan(before + 2 * HOUR + 5_000);
  });

  it("refuses to ban someone who is already banned", async () => {
    const { service } = build([...roster(), user("bad", "reader", { isBanned: true, bannedUntil: null })]);
    await expect(service.applySanction("admin", "bad", { type: "ban", reason: "again" }, CTX)).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows banning someone whose earlier temporary ban has run out", async () => {
    const past = new Date(Date.now() - HOUR);
    const { service, repo } = build([...roster(), user("bad", "reader", { isBanned: true, bannedUntil: past })]);
    await service.applySanction("admin", "bad", { type: "ban", reason: "again" }, CTX);
    expect(repo.createBan).toHaveBeenCalled();
  });

  it("records who acted, audits it, and tells the person", async () => {
    const { service, repo, notifications } = build(roster());
    await service.applySanction("mod", "reader", timeout, CTX);
    expect(repo.createTimeout).toHaveBeenCalledWith(expect.objectContaining({ createdById: "mod", reason: "spamming" }));
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorId: "mod", action: "moderation.timeout", ip: "203.0.113.9" }));
    expect(notifications.notify).toHaveBeenCalledWith("reader", "moderation", expect.any(String), expect.stringContaining("spamming"), "/terms");
  });

  it("trims the reason", async () => {
    const { service, repo } = build(roster());
    await service.applySanction("mod", "reader", { type: "warning", reason: "  be nice  " }, CTX);
    expect(repo.createWarning).toHaveBeenCalledWith(expect.objectContaining({ reason: "be nice" }));
  });
});

describe("ModerationService.revokeSanction", () => {
  const future = new Date(Date.now() + HOUR);
  const base = { createdById: "mod", createdAt: new Date(), revokedAt: null, revokedById: null, reason: "x" };

  it("lifts an active timeout", async () => {
    const { service, repo, notifications } = build(roster());
    repo.findSanction.mockResolvedValue({ ...base, id: "s1", userId: "reader", type: "timeout", expiresAt: future });
    await service.revokeSanction("mod", "reader", "s1", CTX);
    expect(repo.liftTimeout).toHaveBeenCalledWith("reader", "mod");
    expect(notifications.notify).toHaveBeenCalled();
  });

  it("only lets ban-capable staff lift a ban", async () => {
    const { service, repo } = build(roster());
    repo.findSanction.mockResolvedValue({ ...base, id: "s2", userId: "reader", type: "ban", expiresAt: null });
    await expect(service.revokeSanction("mod", "reader", "s2", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await service.revokeSanction("admin", "reader", "s2", CTX);
    expect(repo.liftBan).toHaveBeenCalledWith("reader", "admin");
  });

  it("retracts a warning", async () => {
    const { service, repo } = build(roster());
    repo.findSanction.mockResolvedValue({ ...base, id: "s3", userId: "reader", type: "warning", expiresAt: null });
    await service.revokeSanction("mod", "reader", "s3", CTX);
    expect(repo.retractWarning).toHaveBeenCalledWith("s3", "mod");
  });

  it("refuses a sanction that is already lifted or has expired", async () => {
    const { service, repo } = build(roster());
    repo.findSanction.mockResolvedValue({ ...base, id: "s4", userId: "reader", type: "timeout", expiresAt: future, revokedAt: new Date() });
    await expect(service.revokeSanction("mod", "reader", "s4", CTX)).rejects.toBeInstanceOf(ConflictException);
    repo.findSanction.mockResolvedValue({ ...base, id: "s5", userId: "reader", type: "timeout", expiresAt: new Date(Date.now() - HOUR) });
    await expect(service.revokeSanction("mod", "reader", "s5", CTX)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.liftTimeout).not.toHaveBeenCalled();
  });

  it("404s a sanction that belongs to someone else", async () => {
    const { service, repo } = build(roster());
    repo.findSanction.mockResolvedValue({ ...base, id: "s6", userId: "editor", type: "timeout", expiresAt: future });
    await expect(service.revokeSanction("mod", "reader", "s6", CTX)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ModerationService.resetProfile", () => {
  it("clears only the chosen parts, records it, audits it and tells the person what was removed", async () => {
    const { service, repo, notifications } = build(roster());
    const result = await service.resetProfile("mod", "reader", { parts: ["avatar", "bio"], reason: "offensive picture" }, CTX);
    expect(repo.clearProfileParts).toHaveBeenCalledWith("reader", { avatar: true, bio: true, displayName: false });
    expect(repo.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "reader", type: "profile_reset", details: "avatar,bio", createdById: "mod" })
    );
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "moderation.profile_reset" }));
    expect(notifications.notify).toHaveBeenCalledWith("reader", "moderation", expect.any(String), expect.stringContaining("offensive picture"), "/terms");
    expect(result).toEqual({ cleared: ["avatar", "bio"] });
  });

  it("obeys the same rank rules as a sanction", async () => {
    const { service, repo } = build(roster());
    await expect(service.resetProfile("reader", "other", { parts: ["bio"], reason: "nope nope" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.resetProfile("mod", "mod2", { parts: ["bio"], reason: "peer" }, CTX)).rejects.toMatchObject({ response: { code: "cannot_sanction_equal_or_higher" } });
    await expect(service.resetProfile("admin", "owner", { parts: ["bio"], reason: "owner" }, CTX)).rejects.toMatchObject({ response: { code: "cannot_sanction_owner" } });
    await expect(service.resetProfile("mod", "mod", { parts: ["bio"], reason: "myself" }, CTX)).rejects.toMatchObject({ response: { code: "cannot_sanction_self" } });
    expect(repo.clearProfileParts).not.toHaveBeenCalled();
  });
});

describe("ModerationService.removeAllComments", () => {
  it("hides every comment, records how many, and tells the person", async () => {
    const { service, repo, notifications } = build(roster());
    const result = await service.removeAllComments("mod", "reader", { reason: "spam account" }, CTX);
    expect(result).toEqual({ removed: 3 });
    expect(repo.removeAllComments).toHaveBeenCalledWith("reader", "mod");
    expect(repo.recordAction).toHaveBeenCalledWith(expect.objectContaining({ type: "comments_removed", details: "3" }));
    expect(notifications.notify).toHaveBeenCalledWith("reader", "moderation", expect.any(String), expect.stringContaining("3"), "/terms");
  });

  it("does nothing, and records nothing, when there is nothing to remove", async () => {
    const { service, repo, notifications } = build(roster());
    repo.removeAllComments.mockResolvedValue(0);
    expect(await service.removeAllComments("mod", "reader", { reason: "just checking" }, CTX)).toEqual({ removed: 0 });
    expect(repo.recordAction).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("is staff-only and rank-limited", async () => {
    const { service, repo } = build(roster());
    await expect(service.removeAllComments("other", "reader", { reason: "nope nope" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeAllComments("mod", "admin", { reason: "uppity" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.removeAllComments).not.toHaveBeenCalled();
  });
});

describe("ModerationService.signOutEverywhere", () => {
  it("ends every session and audits it, without notifying or recording a penalty", async () => {
    const { service, repo, notifications } = build(roster());
    expect(await service.signOutEverywhere("mod", "reader", CTX)).toEqual({ sessionsEnded: 2 });
    expect(repo.revokeAllSessions).toHaveBeenCalledWith("reader");
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "moderation.sign_out" }));
    expect(repo.recordAction).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("obeys the rank rules", async () => {
    const { service, repo } = build(roster());
    await expect(service.signOutEverywhere("mod", "admin", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.signOutEverywhere("other", "reader", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.revokeAllSessions).not.toHaveBeenCalled();
  });
});

describe("one-off actions in the history", () => {
  it("cannot be lifted and never read as active", async () => {
    const { service, repo } = build(roster());
    const now = new Date();
    const record = { id: "r1", userId: "reader", type: "profile_reset", reason: "x", details: "bio", createdById: "mod", createdAt: now, expiresAt: null, revokedAt: null, revokedById: null };
    repo.findSanction.mockResolvedValue(record);
    await expect(service.revokeSanction("mod", "reader", "r1", CTX)).rejects.toMatchObject({ response: { code: "sanction_not_revocable" } });
    repo.listSanctions.mockResolvedValue([record]);
    const listed = await service.listForUser("mod", "reader");
    expect(listed.sanctions[0]).toMatchObject({ type: "profile_reset", details: "bio", active: false });
  });
});

describe("ModerationService.listForUser", () => {
  it("is staff only", async () => {
    const { service } = build(roster());
    await expect(service.listForUser("reader", "reader")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("reports the current state and what the viewer may do", async () => {
    const future = new Date(Date.now() + HOUR);
    const { service } = build([...roster(), user("muted", "reader", { mutedUntil: future })]);
    const asMod = await service.listForUser("mod", "muted");
    expect(asMod.user.mutedUntil).toBe(future.toISOString());
    expect(asMod.canSanction).toBe(true);
    expect(asMod.canBan).toBe(false);
    const asAdmin = await service.listForUser("admin", "muted");
    expect(asAdmin.canBan).toBe(true);
    expect(asAdmin.account).toMatchObject({ email: "person@example.com" });
    expect(asMod.account).toBeNull();
    const peer = await service.listForUser("mod", "mod2");
    expect(peer.canSanction).toBe(false);
  });
});
