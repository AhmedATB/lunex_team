import { isReservedUsername, USERNAME_PATTERN, usernameKey } from "./username.util";

describe("usernameKey", () => {
  it("ignores case and underscores", () => {
    const key = usernameKey("qays");
    expect(usernameKey("Qays")).toBe(key);
    expect(usernameKey("QAYS")).toBe(key);
    expect(usernameKey("q_ays")).toBe(key);
    expect(usernameKey("__QA_YS__")).toBe(key);
  });

  it("treats look-alike characters as one", () => {
    expect(usernameKey("s0nic")).toBe(usernameKey("sonic"));
    expect(usernameKey("l1ght")).toBe(usernameKey("light"));
    expect(usernameKey("light")).toBe(usernameKey("Iight"));
    expect(usernameKey("5ara")).toBe(usernameKey("sara"));
  });

  it("keeps genuinely different names apart", () => {
    expect(usernameKey("qays")).not.toBe(usernameKey("qays2"));
    expect(usernameKey("kaito")).not.toBe(usernameKey("kaido"));
    expect(usernameKey("lunexfan")).not.toBe(usernameKey("lunex"));
  });
});

describe("isReservedUsername", () => {
  it("blocks names that would pass for staff, in any spelling of them", () => {
    for (const name of ["admin", "Admin", "ADM1N", "adm_in", "Owner", "0wner", "moderator", "Lunex", "LUNEX_TEAM", "support"]) {
      expect(isReservedUsername(name)).toBe(true);
    }
  });

  it("lets ordinary names through, including ones that merely contain a reserved word", () => {
    for (const name of ["qays_reader", "admin_fan", "lunexfan", "mod_hunter", "teamwork"]) {
      expect(isReservedUsername(name)).toBe(false);
    }
  });
});

describe("USERNAME_PATTERN", () => {
  it("wants 3 to 24 letters, digits or underscores", () => {
    expect(USERNAME_PATTERN.test("ab")).toBe(false);
    expect(USERNAME_PATTERN.test("abc")).toBe(true);
    expect(USERNAME_PATTERN.test("a".repeat(24))).toBe(true);
    expect(USERNAME_PATTERN.test("a".repeat(25))).toBe(false);
    expect(USERNAME_PATTERN.test("with space")).toBe(false);
    expect(USERNAME_PATTERN.test("عربي_name")).toBe(false);
  });
});
