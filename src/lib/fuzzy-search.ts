import type { Series } from "@/lib/types";

/**
 * Forgiving search for series. A visitor who types "dragan dragom" for "Dragon Dragon" still gets it: each word of the
 * query may differ from a word of the title by a letter or two (more for longer words), and words typed only partly are
 * matched against the start of a title word. Everything is compared after the same normalising, so case, accents and
 * the Arabic spellings that people mix (أ إ آ ا, ى ي, ة ه, diacritics) do not matter either.
 *
 * A result is either an exact match (tier 2: every query word appears in the text, spaces aside) or a near one (tier 1).
 * Callers keep whatever order they already sort by and put tier 2 above tier 1.
 */

/** Lower case, no accents or Arabic diacritics, one spelling per Arabic letter, and only single spaces between words. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "") // accents, and the Arabic marks that NFKD splits off أ إ آ ؤ ئ (leaving ا و ي) and the harakat
    .toLowerCase()
    .replace(/ـ/g, "") // tatweel
    .replace(/[ٱ]/g, "ا")
    .replace(/[ىی]/g, "ي")
    .replace(/[ةہۀ]/g, "ه")
    .replace(/ک/g, "ك")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** How many letters a word of this length may be off by: none for very short words, where any change is another word. */
function allowedErrors(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

/** Edit distance where swapping two neighbouring letters ("dragno") counts as one mistake, not two. */
function distance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Two letters of a short word swapped ("teh" for "the"): the one slip worth forgiving in a word too short to allow any. */
function isSwap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i < a.length - 1 && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
}

/** True when `word` is close enough to `token` — as a whole word, or (for a word still being typed) as the start of one. */
function closeTo(token: string, word: string, max: number): boolean {
  if (token.length === 3 && isSwap(token, word)) return true;
  if (Math.abs(token.length - word.length) <= max && distance(token, word) <= max) return true;
  if (token.length < 4 || word.length <= token.length) return false;
  for (let len = token.length - 1; len <= token.length + 1; len++) {
    if (len > 0 && len < word.length && distance(token, word.slice(0, len)) <= max) return true;
  }
  return false;
}

export interface SearchQuery {
  tokens: string[];
  compact: string;
}

export function prepareSearchQuery(text: string): SearchQuery {
  const normalized = normalizeSearchText(text);
  const tokens = normalized ? normalized.split(" ") : [];
  return { tokens, compact: tokens.join("") };
}

/** 0 = does not match, 1 = matches with a slip or two, 2 = matches exactly. `fields` are the texts to look in (empty ones are skipped). */
export function searchTier(query: SearchQuery, fields: readonly (string | null | undefined)[]): 0 | 1 | 2 {
  if (query.tokens.length === 0) return 2;

  const texts = fields.flatMap((field) => (field ? [normalizeSearchText(field)] : [])).filter(Boolean);
  if (texts.length === 0) return 0;

  const haystack = texts.join(" | ");
  const compact = texts.map((text) => text.replace(/ /g, "")).join("|");
  if (query.tokens.every((token) => haystack.includes(token)) || compact.includes(query.compact)) return 2;

  const words = texts.flatMap((text) => text.split(" "));
  const matches = query.tokens.every((token) => {
    if (haystack.includes(token)) return true;
    return words.some((word) => closeTo(token, word, allowedErrors(token.length)));
  });
  return matches ? 1 : 0;
}

/** The items that match (tier 1 or 2), exact matches first; each group keeps the order the items came in. */
export function rankByTier<T>(items: readonly T[], tierOf: (item: T) => 0 | 1 | 2): T[] {
  return items
    .flatMap((item) => {
      const tier = tierOf(item);
      return tier > 0 ? [{ item, tier }] : [];
    })
    .sort((a, b) => b.tier - a.tier)
    .map(({ item }) => item);
}

/** The texts of a series a visitor may search by: both titles, the other names it is known by, and the author. */
export function seriesSearchFields(series: Pick<Series, "title" | "titleAr" | "author" | "alternativeTitles">): string[] {
  return [series.title, series.titleAr, ...(series.alternativeTitles ?? []), series.author];
}
