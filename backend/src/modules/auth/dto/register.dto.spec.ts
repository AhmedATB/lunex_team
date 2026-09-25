import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateProfileDto } from "../../users/dto/update-profile.dto";
import { RegisterDto } from "./register.dto";

const BASE = { email: "new@example.com", username: "kaito_92", password: "correct-horse-battery" };

/** Runs the DTO the way the app's ValidationPipe does (`transform: true`): plain object in, transformed instance and its errors out. */
async function check<T extends object>(cls: new () => T, body: Record<string, unknown>) {
  const instance = plainToInstance(cls, body);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, invalid: errors.map((e) => e.property) };
}

describe("RegisterDto display name", () => {
  it("is optional, so older clients still register", async () => {
    expect((await check(RegisterDto, BASE)).invalid).toEqual([]);
  });

  it("is trimmed and has its runs of whitespace collapsed before it is checked", async () => {
    const { instance, invalid } = await check(RegisterDto, { ...BASE, displayName: "  قيس    أحمد  " });
    expect(invalid).toEqual([]);
    expect(instance.displayName).toBe("قيس أحمد");
  });

  it("accepts Arabic, Latin and mixed names", async () => {
    for (const displayName of ["قيس", "Qays Ahmed", "قيس Ahmed", "Anne-Marie", "田中"]) {
      expect((await check(RegisterDto, { ...BASE, displayName })).invalid).toEqual([]);
    }
  });

  it("refuses one that is too short, too long, or made of markup, symbols or only punctuation", async () => {
    for (const displayName of ["a", " a ", "x".repeat(41), "<b>hi</b>", "a​b", "evil‮txt", "😀", "...", ""]) {
      expect((await check(RegisterDto, { ...BASE, displayName })).invalid).toContain("displayName");
    }
  });

  it("refuses something that is not text", async () => {
    expect((await check(RegisterDto, { ...BASE, displayName: 42 })).invalid).toContain("displayName");
  });
});

describe("UpdateProfileDto display name", () => {
  it("follows the same rule", async () => {
    expect((await check(UpdateProfileDto, { displayName: "  قيس   أحمد " })).instance.displayName).toBe("قيس أحمد");
    expect((await check(UpdateProfileDto, { displayName: "<b>" })).invalid).toContain("displayName");
    expect((await check(UpdateProfileDto, { bio: "hello" })).invalid).toEqual([]);
  });
});
