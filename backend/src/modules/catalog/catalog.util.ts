export const SERIES_TYPES = ["manhwa", "manga", "manhua", "novel"] as const;
export const SERIES_STATUSES = ["ongoing", "completed", "hiatus", "dropped"] as const;
export const COUNTRIES = ["kr", "jp", "cn"] as const;
export const TEAM_CATEGORIES = ["manhwa", "manhua", "manga", "novel", "mixed"] as const;
export const TEAM_STATUSES = ["active", "suspended", "archived"] as const;
export const NEWS_CATEGORIES = ["announcement", "event", "news"] as const;
export const TAG_GROUPS = ["genre", "theme", "format", "content"] as const;

const MAX_SLUG_LENGTH = 80;
const GENRE_GROUPS = new Set(["genre", "theme"]);

/**
 * URL-safe slug that keeps Arabic (and any other) letters: "ملك المصارع!" →
 * "ملك-المصارع". Everything that is not a letter or digit becomes a hyphen and
 * runs collapse. Never empty — an all-symbol title falls back to `fallback`.
 */
export function slugify(text: string, fallback = "item"): string {
  const slug = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** `base`, then `base-2`, `base-3`, … until `taken` says the slug is free. */
export async function uniqueSlug(base: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  let candidate = base;
  for (let n = 2; await taken(candidate); n++) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export type ImageKind = "series" | "banner" | "team" | "news";

/**
 * The public URL of a catalogue image, through the frontend's BFF. The
 * timestamp is only a cache-buster: the endpoint is immutable-cached, so a
 * replaced cover must arrive under a new URL.
 */
export function imageUrl(kind: ImageKind, id: string, assetId: string | null, version: Date): string | null {
  if (!assetId) return null;
  const path = { series: `series/${id}/cover`, banner: `series/${id}/banner`, team: `teams/${id}/logo`, news: `news/${id}/cover` }[kind];
  return `/api/catalog/${path}?v=${version.getTime()}`;
}

/** Shown wherever a series has no cover of its own. */
export const COVER_PLACEHOLDER = "/brand/cover-placeholder.png";

export interface TagRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  group: string;
}

export function toTagDto(tag: TagRow) {
  return { id: tag.slug, slug: tag.slug, name: tag.nameEn, nameAr: tag.nameAr, group: tag.group };
}

export interface SeriesRow {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  alternativeTitles: string[];
  synopsis: string;
  type: string;
  status: string;
  country: string;
  author: string;
  artist: string;
  year: number | null;
  contentRating: string;
  coverAssetId: string | null;
  bannerAssetId: string | null;
  teamId: string | null;
  isFeatured: boolean;
  isRecommended: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: TagRow }[];
}

export interface SeriesStats {
  chapterCount: number;
  latestChapterNumber: number;
  latestChapterAt: Date | null;
  bookmarks: number;
  rating: number;
  ratingCount: number;
}

export const EMPTY_STATS: SeriesStats = { chapterCount: 0, latestChapterNumber: 0, latestChapterAt: null, bookmarks: 0, rating: 0, ratingCount: 0 };

/** The shape the frontend's `Series` type expects, so the UI needs no adapter. */
export function toSeriesDto(row: SeriesRow, stats: SeriesStats = EMPTY_STATS) {
  const cover = imageUrl("series", row.id, row.coverAssetId, row.updatedAt) ?? COVER_PLACEHOLDER;
  const updatedAt = stats.latestChapterAt && stats.latestChapterAt > row.updatedAt ? stats.latestChapterAt : row.updatedAt;
  return {
    id: row.id,
    slug: row.slug,
    title: row.titleEn || row.titleAr,
    titleAr: row.titleAr,
    alternativeTitles: row.alternativeTitles,
    cover,
    banner: imageUrl("banner", row.id, row.bannerAssetId, row.updatedAt) ?? cover,
    synopsis: row.synopsis,
    type: row.type,
    status: row.status,
    country: row.country,
    author: row.author,
    artist: row.artist,
    year: row.year ?? new Date(row.createdAt).getUTCFullYear(),
    contentRating: row.contentRating,
    rating: stats.rating,
    ratingCount: stats.ratingCount,
    views: row.viewCount,
    bookmarks: stats.bookmarks,
    likes: stats.bookmarks,
    // The UI's genre filter covers genres and themes (Martial Arts, School Life, ...); format and content notes stay free-form tags.
    genreIds: row.tags.filter((t) => GENRE_GROUPS.has(t.tag.group)).map((t) => t.tag.slug),
    tags: row.tags.filter((t) => !GENRE_GROUPS.has(t.tag.group)).map((t) => t.tag.nameAr),
    teamId: row.teamId ?? "",
    chapterCount: stats.chapterCount,
    latestChapterNumber: stats.latestChapterNumber,
    updatedAt: updatedAt.toISOString(),
    isFeatured: row.isFeatured,
    isRecommended: row.isRecommended,
  };
}

export interface TeamRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  goals: string;
  color: string;
  logoHue: number;
  logoAssetId: string | null;
  discordUrl: string | null;
  websiteUrl: string | null;
  category: string;
  status: string;
  recruiting: boolean;
  leaderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: { userId: string }[];
}

export function toTeamDto(row: TeamRow, rank: number, lastActivityAt: Date | null) {
  const memberIds = new Set(row.members.map((m) => m.userId));
  if (row.leaderId) memberIds.add(row.leaderId);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoHue: row.logoHue,
    color: row.color,
    logoUrl: imageUrl("team", row.id, row.logoAssetId, row.updatedAt) ?? undefined,
    description: row.description,
    leaderId: row.leaderId ?? "",
    memberIds: [...memberIds],
    discordUrl: row.discordUrl ?? undefined,
    websiteUrl: row.websiteUrl ?? undefined,
    rank,
    recruiting: row.recruiting,
    createdAt: row.createdAt.toISOString(),
    category: row.category,
    goals: row.goals,
    status: row.status,
    lastActivityAt: (lastActivityAt && lastActivityAt > row.updatedAt ? lastActivityAt : row.updatedAt).toISOString(),
  };
}

export interface ChapterRow {
  id: string;
  seriesId: string;
  teamId: string;
  number: number;
  title: string;
  isPublished: boolean;
  scheduledFor: Date | null;
  manualLock: boolean | null;
  publishedAt: Date | null;
  viewCount: number;
  content: string | null;
  createdAt: Date;
  _count?: { pages: number };
}

export function toChapterDto(row: ChapterRow) {
  return {
    id: row.id,
    seriesId: row.seriesId,
    number: row.number,
    title: row.title,
    pages: row._count?.pages ?? 0,
    hasContent: row.content !== null && row.content.length > 0,
    releasedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    views: row.viewCount,
    isPublished: row.isPublished,
    scheduledFor: row.scheduledFor?.toISOString(),
    manualLock: row.manualLock,
    teamId: row.teamId,
  };
}

export interface NewsRow {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  coverAssetId: string | null;
  category: string;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toNewsDto(row: NewsRow) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    cover: imageUrl("news", row.id, row.coverAssetId, row.updatedAt) ?? COVER_PLACEHOLDER,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    authorId: row.authorId ?? "",
  };
}

export interface PersonRow {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  avatarMimeType: string | null;
}

/** A member as the frontend's `User` type wants it: identity from the account, everything gamified starts at zero. */
export function toPersonDto(row: PersonRow, extra: { teamId?: string; teamRole?: string; readCount?: number } = {}) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName ?? row.username,
    avatarSeed: row.id,
    avatarVersion: row.avatarMimeType ? row.updatedAt.toISOString() : null,
    email: "",
    role: row.role,
    teamId: extra.teamId,
    teamRole: extra.teamRole,
    level: 1,
    xp: 0,
    xpToNext: 100,
    joinedAt: row.createdAt.toISOString(),
    bio: row.bio ?? "",
    isOnline: false,
    readCount: extra.readCount ?? 0,
    commentCount: 0,
    bookmarkCount: 0,
    badges: [] as string[],
  };
}
