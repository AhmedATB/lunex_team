/**
 * How a chapter is named wherever it is listed: the number always shows, and the title after it when there is one. Many chapters
 * have no title at all (those brought over from another site), and some have one that leaves the number out ("الإصابة بالتعويذة"),
 * so showing the title alone left a list of blank rows. A title that already contains the number ("الفصل 12", "Chapter 12")
 * is kept as it is, so the number is never shown twice — and never missing.
 */
export function chapterLabel(chapter: { number: number; title?: string | null }): string {
  const title = (chapter.title ?? "").trim();
  if (!title) return `الفصل ${chapter.number}`;
  const number = String(chapter.number).replace(/\./g, "\\.");
  return new RegExp(`(^|[^0-9.])${number}([^0-9]|$)`).test(title) ? title : `الفصل ${chapter.number} — ${title}`;
}
