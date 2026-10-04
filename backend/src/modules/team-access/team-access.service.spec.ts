import type { PrismaService } from "../../prisma/prisma.service";
import { canPublishAt, levelOfRole, TeamAccessService } from "./team-access.service";

function build(teams: { id: string; slug: string; name: string; leaderId: string | null; members: { role: string }[] }[]) {
  const findMany = jest.fn(async () => teams);
  const service = new TeamAccessService({ team: { findMany } } as unknown as PrismaService);
  return { service, findMany };
}

describe("a person's level in a team", () => {
  it("is a lead for the leader's own team even with no member row, and for the three lead roles", async () => {
    const { service } = build([{ id: "t1", slug: "a", name: "A", leaderId: "u1", members: [] }]);
    await expect(service.accessFor("u1")).resolves.toEqual([{ teamId: "t1", slug: "a", name: "A", level: "lead" }]);
    for (const role of ["team_leader", "assistant_leader", "team_administrator"]) {
      expect(levelOfRole(role)).toBe("lead");
    }
  });

  it("is a publisher or an uploader by role, and nothing for the roles that work outside the site", async () => {
    const { service } = build([
      { id: "t1", slug: "a", name: "A", leaderId: "boss", members: [{ role: "publisher" }] },
      { id: "t2", slug: "b", name: "B", leaderId: "boss", members: [{ role: "uploader" }] },
      { id: "t3", slug: "c", name: "C", leaderId: "boss", members: [{ role: "translator" }] },
    ]);
    expect((await service.accessFor("u1")).map((team) => [team.teamId, team.level])).toEqual([["t1", "publisher"], ["t2", "uploader"]]);
    for (const role of ["translator", "editor", "proofreader", "qc", "recruiter", "reviewer", "member", "trainee", ""]) {
      expect(levelOfRole(role)).toBeNull();
    }
  });

  it("only counts teams that are active, and looks at one team when asked for one", async () => {
    const { service, findMany } = build([{ id: "t1", slug: "a", name: "A", leaderId: "u1", members: [] }]);
    await service.levelFor("u1", "t1");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "t1", status: "active" }) }));
    const none = build([]);
    await expect(none.service.levelFor("u1", "t1")).resolves.toBeNull();
  });

  it("lets leads and publishers put chapters live, not uploaders", () => {
    expect(canPublishAt("lead")).toBe(true);
    expect(canPublishAt("publisher")).toBe(true);
    expect(canPublishAt("uploader")).toBe(false);
  });
});
