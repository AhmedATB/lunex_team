/** 3–24 letters, digits and underscores — the same rule the DTOs enforce, for the places that build a name themselves. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;

/**
 * What makes two usernames "the same person" in practice: case is ignored, underscores are ignored, and the
 * look-alikes 0/o, 1/l/i and 5/s are treated as one letter. So `Qays`, `qays`, `q_ays` and `QA_YS` collide, and
 * so do `admin` and `adm1n`. It is stored on the account (`usernameKey`, unique) so the database itself refuses a
 * near-duplicate, even when two sign-ups arrive at the same moment.
 *
 * The SQL that backfilled existing accounts is `translate(lower(username), '01i5_', 'olls')` — keep the two in step.
 */
export function usernameKey(username: string): string {
  return username.toLowerCase().replace(/[01i5_]/g, (c) => LOOKALIKES[c]);
}

const LOOKALIKES: Record<string, string> = { "0": "o", "1": "l", i: "l", "5": "s", _: "" };

/** Names nobody may take, because they would pass for the team or its staff. Compared through `usernameKey`, so `Adm1n` is reserved too. */
const RESERVED = new Set(
  [
    "admin",
    "administrator",
    "owner",
    "moderator",
    "mod",
    "staff",
    "support",
    "system",
    "root",
    "lunex",
    "lunexteam",
    "lunexbot",
    "team",
    "official",
    "help",
    "service",
    "anonymous",
    "everyone",
    "null",
    "undefined",
    "bot",
    "api",
  ].map(usernameKey)
);

/**
 * Held for the owner and the team. Any name that *starts with* one of these (in its folded form) is reserved, so
 * `Lunex`, `LunexTeam`, `lunex_official`, `LUNEX_fan` and `AhmedATB`, `ahmed_atb2` are all refused to sign-ups.
 * Add a name here to hold it; an owner or super administrator can still take one by renaming their own account.
 */
const RESERVED_PREFIXES = ["lunex", "ahmedatb"].map(usernameKey);

export function isReservedUsername(username: string): boolean {
  const key = usernameKey(username);
  return RESERVED.has(key) || RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * The display name is what people actually see next to a comment, so it needs the same protection as the handle:
 * without it, `@kaito_92` could show up as "LUNEX Admin". Letters (any script), marks, digits, spaces and . _ ' -
 * only — no control, zero-width or right-to-left-override characters, which are how a name is made to look like another.
 */
export const DISPLAY_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} ._'-]+$/u;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

/** Trimmed, with runs of whitespace collapsed to one space; anything that is not a string is returned as it came, for the validators to refuse. */
export function normalizeDisplayName<T>(value: T): T | string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

/** Arabic spellings of the same staff titles, compared after the usual normalisation (hamza forms, ta marbuta, diacritics). */
function foldArabic(text: string): string {
  return text
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

const ARABIC_RESERVED = new Set(["ادارة", "الادارة", "مشرف", "المشرف", "مدير", "المدير", "الدعم", "دعم"].map(foldArabic));
const ARABIC_RESERVED_PREFIXES = ["لونكس"].map(foldArabic);

/**
 * Would this display name pass for the team or its staff? Spaces and punctuation are ignored and the same look-alikes
 * as usernames are folded, so `L U N E X`, `Lunex.Team` and `Adm1n` are all caught. Two people may share an ordinary
 * display name — only these are held back.
 */
export function isReservedDisplayName(displayName: string): boolean {
  const letters = displayName.replace(/[^\p{L}\p{M}\p{N}]/gu, "");
  if (isReservedUsername(letters)) return true;
  const arabic = foldArabic(letters);
  return ARABIC_RESERVED.has(arabic) || ARABIC_RESERVED_PREFIXES.some((prefix) => arabic.startsWith(prefix));
}
