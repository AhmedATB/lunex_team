import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fixTanween, fixTanweenAll } from "./arabic.util";

const ALEF = "\u0627";
const FATHATAN = "\u064B";

describe("fixTanween", () => {
  it("moves the fathatan from the alef to the letter before it", () => {
    expect(fixTanween(`دائم${ALEF}${FATHATAN}`)).toBe(`دائم${FATHATAN}${ALEF}`);
    expect(fixTanween(`دائمًا`)).toBe(`دائمًا`);
    expect(fixTanween(`جزء${ALEF}${FATHATAN} وأيض${ALEF}${FATHATAN}`)).toBe(`جزء${FATHATAN}${ALEF} وأيض${FATHATAN}${ALEF}`);
  });

  it("leaves everything else alone, including a tanween that is not on an alef", () => {
    expect(fixTanween("مرةً")).toBe("مرةً");
    expect(fixTanween("plain text")).toBe("plain text");
    expect(fixTanween("")).toBe("");
    expect(fixTanween(null)).toBeNull();
    expect(fixTanween(undefined)).toBeUndefined();
  });

  it("works on lists", () => {
    expect(fixTanweenAll([`أبد${ALEF}${FATHATAN}`, "x"])).toEqual([`أبد${FATHATAN}${ALEF}`, "x"]);
  });
});

/** The rule is permanent: no source file of the backend may spell it the other way. */
describe("the backend source", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it("never writes the tanween on the alef", () => {
    const offenders = files(join(__dirname, "..", "..")).filter((file) => readFileSync(file, "utf8").includes(`${ALEF}${FATHATAN}`) && !file.endsWith("arabic.util.spec.ts"));
    expect(offenders).toEqual([]);
  });
});
