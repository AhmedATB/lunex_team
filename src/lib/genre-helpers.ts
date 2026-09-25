import type { Genre } from "@/lib/types";

/** Id -> Arabic name for the genre chips. CatalogProvider keeps it in step with whichever catalogue is showing. */
export const genreNameById = new Map<string, string>();

export function registerGenres(genres: Genre[]) {
  genreNameById.clear();
  for (const g of genres) genreNameById.set(g.id, g.nameAr);
}

export const GENRE_CHIP_STYLES = [
  "bg-primary-600/90 text-white",
  "bg-amber-400 text-amber-950",
  "bg-[#c084fc] text-[#2c0a4d]",
];

export function genreLabelsFor(genreIds: string[], limit = 3): string[] {
  return genreIds
    .slice(0, limit)
    .map((id) => genreNameById.get(id))
    .filter(Boolean) as string[];
}
