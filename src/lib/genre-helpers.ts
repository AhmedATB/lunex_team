import { getMockDatabase } from "@/lib/mock/generate";

export const genreNameById = new Map(getMockDatabase().genres.map((g) => [g.id, g.nameAr]));

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
