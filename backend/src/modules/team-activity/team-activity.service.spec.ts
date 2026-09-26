import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { TeamActivityRepository } from "./team-activity.repository";
import { TeamActivityService } from "./team-activity.service";
import { describeActivity } from "./team-activity.text";

const at = new Date("2026-09-26T10:00:00Z");

function build(options: { rows?: Record<string, unknown>[]; names?: { id: string; username: string; displayName: string | null }[]; createFails?: boolean } = {}) {
  const repo = {
    findActor: jest.fn(async (id: string) => {
      const roles: Record<string, string> = { boss: "owner", lead: "reader", assistant: "reader", plain: "reader" };
      return roles[id] ? { id, role: roles[id], isBanned: false, bannedUntil: null, mutedUntil: null } : null;
    }),
    findTeam: jest.fn(async (id: string) => (id === "t1" ? { id: "t1", leaderId: "lead", members: [{ userId: "assistant", role: "assistant_leader" }, { userId: "plain", role: "translator" }] } : null)),
    create: jest.fn(async () => {
      if (options.createFails) throw new Error("db down");
      return { id: "a1" };
    }),
    list: jest.fn(async () => options.rows ?? []),
    names: jest.fn(async () => options.names ?? []),
  };
  return { service: new TeamActivityService(repo as unknown as TeamActivityRepository), repo };
}

describe("recording", () => {
  it("stores codes and ids, and never throws when the log itself fails", async () => {
    const { service, repo } = build();
    await service.record("t1", "member_removed", { actorId: "lead", subjectId: "plain" });
    expect(repo.create).toHaveBeenCalledWith({ teamId: "t1", action: "member_removed", actorId: "lead", subjectId: "plain", detail: null });
    await expect(build({ createFails: true }).service.record("t1", "team_updated")).resolves.toBeUndefined();
  });

  it("ignores an event with no team (a work that belongs to none)", async () => {
    const { service, repo } = build();
    await service.record(null, "chapter_published", { detail: "1 من عمل" });
    await service.record(undefined, "chapter_published");
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("reading the log", () => {
  const rows = [
    { id: "1", teamId: "t1", actorId: "lead", subjectId: "plain", action: "member_role_changed", detail: "editor", at },
    { id: "2", teamId: "t1", actorId: "gone", subjectId: "plain", action: "member_removed", detail: null, at },
    { id: "3", teamId: "t1", actorId: null, subjectId: null, action: "chapter_published", detail: "7 من الوردة", at },
    { id: "4", teamId: "t1", actorId: "lead", subjectId: null, action: "from_a_newer_version", detail: null, at },
  ];
  const names = [{ id: "lead", username: "lead", displayName: "سارة" }, { id: "plain", username: "omar", displayName: null }];

  it("puts the sentence together with the names as they are now, and a stand-in for an account that is gone", async () => {
    const { service } = build({ rows, names });
    const { items } = await service.list("lead", "t1");
    expect(items.map((i) => i.text)).toEqual([
      "تغيير دور omar إلى محرر — بواسطة سارة",
      "إزالة omar من الفريق — بواسطة عضو سابق",
      "نشر الفصل 7 من الوردة", // nobody did it: the site did, so nobody is named
    ]); // the entry written by a newer version is left out, not shown as gibberish
    expect(items[0]).toMatchObject({ id: "1", at: at.toISOString() });
  });

  it("is for the team's leaders, an assistant and the site's managers only", async () => {
    for (const who of ["lead", "assistant", "boss"]) await expect(build({ rows, names }).service.list(who, "t1")).resolves.toHaveProperty("items");
    await expect(build().service.list("plain", "t1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().service.list("nobody", "t1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().service.list("boss", "no-team")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("the words", () => {
  it("names roles and statuses in Arabic, with nouns so no gender is guessed", () => {
    expect(describeActivity("team_status_changed", { actor: "س", subject: "", detail: "suspended" })).toBe("تغيير حالة الفريق إلى معلّق — بواسطة س");
    expect(describeActivity("application_accepted", { actor: "س", subject: "ع", detail: "translator" })).toBe("قبول ع في الفريق بدور مترجم — بواسطة س");
    expect(describeActivity("leader_changed", { actor: null, subject: "", detail: null })).toBe("إزالة قائد الفريق");
    expect(describeActivity("collaboration_received", { actor: null, subject: "", detail: "Nova" })).toBe("وصل طلب تعاون من فريق Nova");
    expect(describeActivity("nothing", { actor: "س", subject: "", detail: null })).toBeNull();
  });
});
