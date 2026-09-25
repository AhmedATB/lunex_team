import type { MockDatabase } from "@/lib/mock/generate";
import type { Chapter, Genre, NewsItem, Series, Team, User } from "@/lib/types";

/**
 * Everything a page reads about the catalogue. It is the same shape the
 * sample-data generator always produced (so no page had to change how it
 * reads it), plus two lists the real catalogue adds: the newest chapters
 * (real chapter lists are fetched per series) and the top readers.
 */
export interface Catalog extends MockDatabase {
  recentChapters: Chapter[];
  topReaders: User[];
  /** Headline numbers for the admin overview. */
  stats: { members: number; comments: number; chapters: number };
}

/** A member as the backend describes them; `role` and `teamRole` are plain strings on the wire. */
export type CatalogPerson = Omit<User, "role" | "teamRole"> & { role: string; teamRole?: string };

/** What crosses from the server to the browser: only the real data, plain JSON. */
export interface CatalogSeed {
  genres: Genre[];
  teams: Team[];
  users: User[];
  series: Series[];
  recentChapters: Chapter[];
  news: NewsItem[];
  topReaders: User[];
  stats: { members: number; comments: number; chapters: number };
}
