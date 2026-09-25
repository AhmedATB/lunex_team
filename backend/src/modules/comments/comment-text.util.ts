/**
 * Cleans a comment before it is stored. React escapes on render, so this is not
 * an XSS filter: it stops the things that make a comment hard to read or moderate
 * (invisible characters, runs of blank lines, padding).
 *
 * Returns null when nothing is left to post. Length is NOT cut here: an over-long
 * comment is rejected by the service so the author knows, rather than silently truncated.
 */
export function cleanCommentText(raw: string): string | null {
  const cleaned = raw
    .normalize("NFC")
    // Zero-width and bidi-control characters: invisible, and used to smuggle links or reverse text past a reader.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    // Other control characters, keeping newline and tab.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length === 0 ? null : cleaned;
}
