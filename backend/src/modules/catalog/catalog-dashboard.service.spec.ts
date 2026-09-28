import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { CatalogRepository } from "./catalog.repository";
import { CatalogDashboardService } from "./catalog-dashboard.service";

const NOW = new Date("2026-09-28T12:30:00.000Z");
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * 86_400_000 - hours * 3_600_000);

function build(
  options: {
    role?: string;
    banned?: boolean;
    office?: boolean;
    published?: Date[];
    perTeam?: { teamId: string | null; chapters: number }[];
    chapters?: { seriesId: string; number: number; publishedAt: Date }[];
    series?: { titleAr: string; titleEn: string; createdAt: Date }[];
    members?: { displayName: string | null; username: string; createdAt: Date }[];
  } = {}
) {
  const repo = {
    findActor: jest.fn(async () => ({ id: "u1", role: options.role ?? "owner", isBanned: options.banned ?? false, bannedUntil: null, mutedUntil: null })),
    holdsTeamOffice: jest.fn(async () => options.office ?? false),
    publishedChapterDatesSince: jest.fn(async () => options.published ?? []),
    chaptersPerTeamSince: jest.fn(async () => options.perTeam ?? []),
    publishedChaptersSince: jest.fn(async () => options.chapters ?? []),
    newestSeries: jest.fn(async () => options.series ?? []),
    newestMembers: jest.fn(async () => options.members ?? []),
    seriesTitles: jest.fn(async () => new Map([["s1", "Shadow slave"], ["s2", "وردة القمر"]])),
    teamNames: jest.fn(async () => new Map([["t1", "Nova team"], ["t2", "Delta"]])),
  };
  return { service: new CatalogDashboardService(repo as unknown as CatalogRepository), repo };
}

describe("who may see the overview", () => {
  it("is open to staff and to someone who holds an office in a team, and to no other reader", async () => {
    await expect(build({ role: "owner" }).service.dashboard("u1", NOW)).resolves.toBeDefined();
    await expect(build({ role: "editor" }).service.dashboard("u1", NOW)).resolves.toBeDefined();
    await expect(build({ role: "reader", office: true }).service.dashboard("u1", NOW)).resolves.toBeDefined();
    await expect(build({ role: "reader", office: false }).service.dashboard("u1", NOW)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses a banned account, and one that no longer exists", async () => {
    await expect(build({ banned: true }).service.dashboard("u1", NOW)).rejects.toBeInstanceOf(ForbiddenException);
    const gone = build();
    gone.repo.findActor.mockResolvedValue(null as never);
    await expect(gone.service.dashboard("u1", NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("chapters published per week", () => {
  it("counts each of the last eight weeks, oldest first — the last one ending now", async () => {
    const published = [ago(0, 1), ago(1), ago(2), ago(8), ago(15), ago(15, 5), ago(50)];
    const { weeks } = await build({ published }).service.dashboard("u1", NOW);
    expect(weeks).toHaveLength(8);
    expect(weeks.map((w) => w.chapters)).toEqual([1, 0, 0, 0, 0, 2, 1, 3]);
    expect(new Date(weeks[7].start).getTime()).toBe(NOW.getTime() - 7 * 86_400_000);
  });

  it("is all zeros with nothing published, not an error", async () => {
    const { weeks } = await build().service.dashboard("u1", NOW);
    expect(weeks.every((w) => w.chapters === 0)).toBe(true);
  });
});

describe("chapters per team", () => {
  it("names the teams, calls a work with no team by that, and lists the busiest first (at most six)", async () => {
    const perTeam = [
      { teamId: "t2", chapters: 3 },
      { teamId: null, chapters: 5 },
      { teamId: "t1", chapters: 9 },
      { teamId: "gone", chapters: 1 },
    ];
    const { teams } = await build({ perTeam }).service.dashboard("u1", NOW);
    expect(teams).toEqual([
      { name: "Nova team", chapters: 9 },
      { name: "بدون فريق", chapters: 5 },
      { name: "Delta", chapters: 3 },
      { name: "بدون فريق", chapters: 1 },
    ]);
    const many = Array.from({ length: 10 }, (_, i) => ({ teamId: null, chapters: i + 1 }));
    expect((await build({ perTeam: many }).service.dashboard("u1", NOW)).teams).toHaveLength(6);
  });
});

describe("what has just happened", () => {
  it("shows chapters published, works added and members joined, newest first", async () => {
    const { recent } = await build({
      chapters: [{ seriesId: "s1", number: 20, publishedAt: ago(0, 0.5) }],
      series: [{ titleAr: "", titleEn: "Moon Rose", createdAt: ago(1) }],
      members: [{ displayName: "سارة", username: "sara", createdAt: ago(0, 3) }],
    }).service.dashboard("u1", NOW);
    expect(recent.map((e) => [e.kind, e.text])).toEqual([
      ["chapter", "نُشر الفصل 20 من Shadow slave"],
      ["member", "انضم عضو جديد: سارة"],
      ["series", "أُضيف عمل جديد: Moon Rose"],
    ]);
  });

  it("makes the chapters of one work published on one day a single line, and keeps other works and other days apart", async () => {
    const { recent } = await build({
      chapters: [
        { seriesId: "s1", number: 20, publishedAt: new Date("2026-09-28T12:16:00Z") },
        { seriesId: "s1", number: 13, publishedAt: new Date("2026-09-28T11:57:00Z") },
        { seriesId: "s1", number: 15, publishedAt: new Date("2026-09-28T12:00:00Z") },
        { seriesId: "s2", number: 6, publishedAt: new Date("2026-09-28T11:51:00Z") },
        { seriesId: "s1", number: 12, publishedAt: new Date("2026-09-26T16:00:00Z") },
      ],
    }).service.dashboard("u1", NOW);
    expect(recent.map((e) => e.text)).toEqual([
      "نُشرت الفصول 13–20 (3) من Shadow slave",
      "نُشر الفصل 6 من وردة القمر",
      "نُشر الفصل 12 من Shadow slave",
    ]);
    expect(recent[0].at).toBe("2026-09-28T12:16:00.000Z"); // dated by the newest of the group
  });

  it("shows no more than eight", async () => {
    const members = Array.from({ length: 3 }, (_, i) => ({ displayName: `m${i}`, username: `m${i}`, createdAt: ago(i + 1) }));
    const chapters = Array.from({ length: 12 }, (_, i) => ({ seriesId: i % 2 ? "s1" : "s2", number: i, publishedAt: ago(i, 1) }));
    const { recent } = await build({ chapters, members }).service.dashboard("u1", NOW);
    expect(recent.length).toBeLessThanOrEqual(8);
  });
});
