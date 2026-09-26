import type { Genre, Series } from "@/lib/types";

/**
 * The genres the home page's "browse by category" shows, in this order. The full list (some seventy genres and themes)
 * is far too long for a front page, so only the ones readers look for first are here; every genre is still available in
 * the filters on /search and /series.
 */
export const ESSENTIAL_GENRE_SLUGS = [
  "action",
  "adventure",
  "fantasy",
  "romance",
  "comedy",
  "drama",
  "horror",
  "mystery",
  "thriller",
  "sci-fi",
  "supernatural",
  "martial-arts",
  "survival",
  "school-life",
  "psychological",
  "isekai",
  "sports",
  "historical",
] as const;

/**
 * The essential genres that at least one series actually has, in the curated order. A category nobody has written for
 * would open an empty results page, so it stays off the front page until a series uses it.
 */
export function pickEssentialGenres(genres: Genre[], series: Iterable<Series>): Genre[] {
  const used = new Set<string>();
  for (const s of series) for (const id of s.genreIds) used.add(id);

  const bySlug = new Map(genres.map((genre) => [genre.slug, genre]));
  return ESSENTIAL_GENRE_SLUGS.flatMap((slug) => {
    const genre = bySlug.get(slug);
    return genre && used.has(genre.id) ? [genre] : [];
  });
}
