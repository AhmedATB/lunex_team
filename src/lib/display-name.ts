/** Same rule as the server's (backend/src/modules/users/username.util.ts): any script, digits, spaces and . _ ' - — with at least one letter or digit. */
const DISPLAY_NAME_PATTERN = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} ._'-]+$/u;

/** What the server will store: trimmed, runs of whitespace collapsed to one space. */
export function cleanDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Why a display name would be refused, or null when it is fine (or still empty — the caller decides whether empty is allowed). */
export function displayNameProblem(name: string): string | null {
  const clean = cleanDisplayName(name);
  if (!clean) return null;
  if (clean.length < 2) return "حرفان على الأقل.";
  if (clean.length > 40) return "٤٠ حرفًا كحد أقصى.";
  if (!DISPLAY_NAME_PATTERN.test(clean)) return "حروف وأرقام ومسافات ونقطة وشرطة فقط.";
  return null;
}
