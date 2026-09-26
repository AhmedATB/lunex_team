/**
 * The site's Arabic rule: the tanween fathatan sits on the letter BEFORE the final alef — دائمًا (fathatan, then alef), never the other way round.
 * Text the backend hands out (titles, synopses, descriptions, comments, notifications) goes through this, so the rule
 * holds for what was typed by anyone, imported from the old site, or written years ago. (Text written in the frontend's
 * own source is held to it by a lint rule.)
 */
const ALEF_THEN_FATHATAN = /\u0627\u064B/g;

export function fixTanween<T extends string | null | undefined>(text: T): T {
  if (typeof text !== "string" || text.length === 0) return text;
  return text.replace(ALEF_THEN_FATHATAN, "\u064B\u0627") as T;
}

export function fixTanweenAll(texts: readonly string[]): string[] {
  return texts.map((text) => fixTanween(text));
}
