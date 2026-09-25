import { DISPLAY_NAME_PATTERN, isReservedDisplayName, isReservedUsername, normalizeDisplayName, USERNAME_PATTERN, usernameKey } from "./username.util";

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

  it("holds the team's own handles and everything that starts with them", () => {
    for (const name of ["Lunex", "LunexTeam", "lunex_official", "Lunexteam", "LUNEXFAN", "AhmedATB", "ahmed_atb", "AhmedATB2", "AHMEDATB_official"]) {
      expect(isReservedUsername(name)).toBe(true);
    }
  });

  it("lets ordinary names through, including ones that merely contain a reserved word", () => {
    for (const name of ["qays_reader", "admin_fan", "mod_hunter", "teamwork", "the_lunex", "ahmed", "ahmad_atb1", "atb_ahmed"]) {
      expect(isReservedUsername(name)).toBe(false);
    }
  });
});

describe("display names", () => {
  it("are normalised: trimmed, with runs of whitespace collapsed", () => {
    expect(normalizeDisplayName("  Qays   Ahmed  ")).toBe("Qays Ahmed");
    expect(normalizeDisplayName("قيس\t أحمد")).toBe("قيس أحمد");
    expect(normalizeDisplayName(42)).toBe(42); // not a string: left for the validators to refuse
  });

  it("allow any script, digits, spaces and . _ ' -", () => {
    for (const name of ["Qays", "قيس أحمد", "Kaito_92", "Anne-Marie O'Neil", "Dr. Who", "田中 太郎", "Sara 2"]) {
      expect(DISPLAY_NAME_PATTERN.test(name)).toBe(true);
    }
  });

  it("refuse markup, control, zero-width and direction-override characters", () => {
    for (const name of ["<b>hi</b>", "a​b", "evil‮txt", "a\nb", "😀 fun", "name@site", "a/b", "...", "- -"]) {
      expect(DISPLAY_NAME_PATTERN.test(name)).toBe(false);
    }
  });

  it("are held back when they would pass for the team, however they are spaced or spelled", () => {
    for (const name of ["Admin", "L U N E X", "Lunex.Team", "LUNEX Admin", "Adm1n", "Ahmed ATB", "Support", "لونكس", "لونكس تيم", "الإدارة", "المشرف", "مدير"]) {
      expect(isReservedDisplayName(name)).toBe(true);
    }
  });

  it("let ordinary names through, and two people may share one", () => {
    for (const name of ["Qays", "قيس أحمد", "Kaito", "Sara", "Mod Hunter", "The Lunex fan", "Ahmed", "ادارة الوقت"]) {
      expect(isReservedDisplayName(name)).toBe(false);
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
