import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { NotificationsService } from "../notifications/notifications.service";
import { AuthService } from "./auth.service";
import type { AuthRepository } from "./auth.repository";

const CTX = { ip: "203.0.113.5" } as RequestContext;

/** Accounts that already exist, looked up the way the repository does: by exact name, and by folded key. */
function build(existing: { username: string; email: string }[] = []) {
  const key = (name: string) => name.toLowerCase().replace(/[01i5_]/g, (c) => ({ "0": "o", "1": "l", i: "l", "5": "s", _: "" })[c] as string);
  const repo = {
    findUserByEmail: jest.fn(async (email: string) => existing.find((u) => u.email === email) ?? null),
    findUserByUsername: jest.fn(async (name: string) => existing.find((u) => u.username === name) ?? null),
    findUserByUsernameKey: jest.fn(async (name: string) => existing.find((u) => key(u.username) === key(name)) ?? null),
    createUser: jest.fn(async (email: string, username: string) => ({ id: "new", email, username, role: "reader" })),
    writeAuditLog: jest.fn(async () => ({})),
  };
  const service = new AuthService(
    repo as unknown as AuthRepository,
    {} as JwtService,
    { getOrThrow: () => "pepper" } as unknown as ConfigService,
    {} as NotificationsService
  );
  // Sessions are not what these tests are about.
  jest.spyOn(service as unknown as { issueSession: () => Promise<unknown> }, "issueSession").mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresIn: 600 });
  return { service, repo };
}

describe("username availability", () => {
  const taken = [{ username: "Qays", email: "qays@example.com" }];

  it("says a free name is free", async () => {
    const { service } = build(taken);
    expect(await service.usernameAvailability("kaito")).toEqual({ available: true });
  });

  it("refuses a name that is too short, too long or not letters/digits/underscores", async () => {
    const { service } = build();
    for (const name of ["ab", "a".repeat(25), "no spaces", "عربي"]) {
      expect(await service.usernameAvailability(name)).toEqual({ available: false, reason: "invalid" });
    }
  });

  it("refuses the same name and every look-alike of it", async () => {
    const { service } = build(taken);
    for (const name of ["Qays", "qays", "QAYS", "q_ays", "Q_A_Y_S", "qa_ys", "qay5", "QAY5"]) {
      expect(await service.usernameAvailability(name)).toMatchObject({ available: false, reason: "taken" });
    }
    expect(await service.usernameAvailability("qays2")).toEqual({ available: true });
  });

  it("refuses names that would pass for staff", async () => {
    const { service } = build();
    for (const name of ["admin", "ADMIN", "adm1n", "Owner", "0wner", "lunex", "Lunex_Team", "LunexOfficial", "AhmedATB", "ahmed_atb", "support"]) {
      expect(await service.usernameAvailability(name)).toEqual({ available: false, reason: "reserved" });
    }
  });
});

describe("register", () => {
  it("rejects a look-alike of an existing name without saying which field clashed", async () => {
    const { service, repo } = build([{ username: "Qays", email: "qays@example.com" }]);
    await expect(service.register("other@example.com", "correct-horse-battery", "q_ays", CTX)).rejects.toMatchObject({
      response: { code: "registration_failed" },
    });
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("rejects a reserved name", async () => {
    const { service, repo } = build();
    await expect(service.register("a@example.com", "correct-horse-battery", "Adm1n", CTX)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("creates the account for a free name", async () => {
    const { service, repo } = build();
    const result = await service.register("new@example.com", "correct-horse-battery", "kaito_92", CTX);
    expect(repo.createUser).toHaveBeenCalledWith("new@example.com", "kaito_92", expect.any(String));
    expect(result.user.username).toBe("kaito_92");
  });

  it("turns the database's unique-index refusal (two sign-ups at once) into the same answer", async () => {
    const { service, repo } = build();
    repo.createUser.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }));
    await expect(service.register("new@example.com", "correct-horse-battery", "kaito_92", CTX)).rejects.toMatchObject({
      response: { code: "registration_failed" },
    });
  });
});
