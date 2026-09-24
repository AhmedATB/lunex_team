import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { DEFAULT_RETENTION_DAYS, RetentionService } from "./retention.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-25T12:00:00.000Z");

interface Row {
  id: string;
  at: Date;
}

const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

/** Minimal in-memory stand-in for the three Prisma delegates the service touches. */
function fakeDelegate(rows: Row[]) {
  return {
    rows,
    findMany: jest.fn(async ({ where, take }: { where: { at: { lt: Date } }; take: number }) =>
      rows.filter((r) => r.at < where.at.lt).slice(0, take).map((r) => ({ id: r.id }))
    ),
    deleteMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
      const doomed = new Set(where.id.in);
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (doomed.has(rows[i].id)) {
          rows.splice(i, 1);
          count++;
        }
      }
      return { count };
    }),
  };
}

function build(env: Record<string, string> = {}) {
  const loginEvent = fakeDelegate([]);
  const imageAccessLog = fakeDelegate([]);
  const auditLog = fakeDelegate([]);
  const prisma = { loginEvent, imageAccessLog, auditLog } as unknown as PrismaService;
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return { service: new RetentionService(prisma, config), loginEvent, imageAccessLog, auditLog };
}

describe("RetentionService", () => {
  it("deletes each log only once it is past its own window", async () => {
    const { service, loginEvent, imageAccessLog, auditLog } = build();
    loginEvent.rows.push({ id: "l-old", at: daysAgo(91) }, { id: "l-new", at: daysAgo(89) });
    imageAccessLog.rows.push({ id: "i-old", at: daysAgo(181) }, { id: "i-new", at: daysAgo(100) });
    auditLog.rows.push({ id: "a-old", at: daysAgo(366) }, { id: "a-new", at: daysAgo(200) });

    const result = await service.runOnce(NOW);

    expect(result).toEqual({ loginEvents: 1, imageAccessLog: 1, auditLog: 1 });
    expect(loginEvent.rows.map((r) => r.id)).toEqual(["l-new"]);
    expect(imageAccessLog.rows.map((r) => r.id)).toEqual(["i-new"]);
    expect(auditLog.rows.map((r) => r.id)).toEqual(["a-new"]);
  });

  it("uses the documented defaults", () => {
    expect(DEFAULT_RETENTION_DAYS).toEqual({ loginEvents: 90, imageAccessLog: 180, auditLog: 365 });
  });

  it("empties a backlog larger than one batch", async () => {
    const { service, loginEvent } = build();
    for (let i = 0; i < 5_001; i++) loginEvent.rows.push({ id: `old-${i}`, at: daysAgo(400) });
    loginEvent.rows.push({ id: "keep", at: daysAgo(1) });

    const result = await service.runOnce(NOW);

    expect(result.loginEvents).toBe(5_001);
    expect(loginEvent.rows.map((r) => r.id)).toEqual(["keep"]);
    expect(loginEvent.deleteMany).toHaveBeenCalledTimes(2);
  });

  it("honours a valid env override", async () => {
    const { service, loginEvent } = build({ RETENTION_LOGIN_EVENTS_DAYS: "30" });
    loginEvent.rows.push({ id: "l-31", at: daysAgo(31) }, { id: "l-29", at: daysAgo(29) });

    await service.runOnce(NOW);

    expect(loginEvent.rows.map((r) => r.id)).toEqual(["l-29"]);
  });

  it.each(["0", "1", "6", "-5", "abc", "", "3.5"])("ignores the unsafe override %p and keeps the default", async (bad) => {
    const { service, loginEvent } = build({ RETENTION_LOGIN_EVENTS_DAYS: bad });
    loginEvent.rows.push({ id: "l-89", at: daysAgo(89) }, { id: "l-91", at: daysAgo(91) });

    await service.runOnce(NOW);

    expect(loginEvent.rows.map((r) => r.id)).toEqual(["l-89"]);
  });

  it("does nothing on an empty database", async () => {
    const { service } = build();
    await expect(service.runOnce(NOW)).resolves.toEqual({ loginEvents: 0, imageAccessLog: 0, auditLog: 0 });
  });
});
