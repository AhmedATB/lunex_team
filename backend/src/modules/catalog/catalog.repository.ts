import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { roundRating, trendingSince, type SeriesStats } from "./catalog.util";

const WITH_TAGS = { tags: { include: { tag: true } } } as const;
const TEAM_INCLUDE = { members: { select: { userId: true } } } as const;
const PERSON_SELECT = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  avatarMimeType: true,
  xp: true,
  chaptersRead: true,
  profileVisibility: true,
} as const;

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- series -------------------------------------------------------------

  listApprovedSeries() {
    return this.prisma.series.findMany({ where: { state: "approved" }, include: WITH_TAGS, orderBy: { updatedAt: "desc" } });
  }

  findSeriesBySlug(slug: string) {
    return this.prisma.series.findFirst({ where: { slug, state: "approved" }, include: WITH_TAGS });
  }

  findSeriesById(id: string) {
    return this.prisma.series.findUnique({ where: { id }, include: WITH_TAGS });
  }

  findSeriesByLegacyId(legacyId: string) {
    return this.prisma.series.findUnique({ where: { legacyId }, select: { id: true } });
  }

  /** Imported series that still need a cover picture fetched. */
  async listImportedSeriesWithoutCover(): Promise<{ id: string; legacyId: string }[]> {
    const rows = await this.prisma.series.findMany({
      where: { legacyId: { not: null }, coverAssetId: null },
      select: { id: true, legacyId: true },
    });
    return rows.flatMap((r) => (r.legacyId ? [{ id: r.id, legacyId: r.legacyId }] : []));
  }

  seriesSlugTaken(slug: string) {
    return this.prisma.series.count({ where: { slug } }).then((n) => n > 0);
  }

  /** Chapter counts, latest chapter and bookmark counts for a set of series — two grouped queries, not two per series. */
  async statsFor(seriesIds: string[]): Promise<Map<string, SeriesStats>> {
    const stats = new Map<string, SeriesStats>();
    if (seriesIds.length === 0) return stats;

    const [chapters, bookmarks, ratings, weekViews] = await Promise.all([
      this.prisma.chapter.groupBy({
        by: ["seriesId"],
        where: { seriesId: { in: seriesIds }, isPublished: true },
        _count: { _all: true },
        _max: { number: true, publishedAt: true, createdAt: true },
      }),
      this.prisma.bookmark.groupBy({ by: ["seriesId"], where: { seriesId: { in: seriesIds } }, _count: { _all: true } }),
      this.prisma.seriesRating.groupBy({ by: ["seriesId"], where: { seriesId: { in: seriesIds } }, _avg: { value: true }, _count: { _all: true } }),
      this.prisma.chapterView.groupBy({ by: ["seriesId"], where: { seriesId: { in: seriesIds }, day: { gte: trendingSince() } }, _count: { _all: true } }),
    ]);

    const bookmarkCounts = new Map(bookmarks.map((b) => [b.seriesId, b._count._all]));
    const ratingOf = new Map(ratings.map((r) => [r.seriesId, { average: roundRating(r._avg.value ?? 0), count: r._count._all }]));
    const weekOf = new Map(weekViews.map((v) => [v.seriesId, v._count._all]));
    for (const id of seriesIds) {
      stats.set(id, {
        chapterCount: 0,
        latestChapterNumber: 0,
        latestChapterAt: null,
        bookmarks: bookmarkCounts.get(id) ?? 0,
        rating: ratingOf.get(id)?.average ?? 0,
        ratingCount: ratingOf.get(id)?.count ?? 0,
        viewsWeek: weekOf.get(id) ?? 0,
      });
    }
    for (const c of chapters) {
      const current = stats.get(c.seriesId);
      if (!current) continue;
      current.chapterCount = c._count._all;
      current.latestChapterNumber = c._max.number ?? 0;
      current.latestChapterAt = c._max.publishedAt ?? c._max.createdAt ?? null;
    }
    return stats;
  }

  createSeries(data: {
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
    teamId: string | null;
    isFeatured: boolean;
    isRecommended: boolean;
    state: string;
    legacyId?: string;
    createdAt?: Date;
    tagIds: string[];
  }) {
    const { tagIds, ...rest } = data;
    return this.prisma.series.create({
      data: { ...rest, tags: { create: tagIds.map((tagId) => ({ tagId })) } },
      include: WITH_TAGS,
    });
  }

  async updateSeries(
    id: string,
    data: Partial<{
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
      teamId: string | null;
      isFeatured: boolean;
      featuredOrder: number | null;
      isRecommended: boolean;
      state: string;
      coverAssetId: string | null;
      bannerAssetId: string | null;
    }>,
    tagIds?: string[]
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (tagIds) {
        await tx.seriesTag.deleteMany({ where: { seriesId: id } });
        await tx.seriesTag.createMany({ data: tagIds.map((tagId) => ({ seriesId: id, tagId })) });
      }
      return tx.series.update({ where: { id }, data, include: WITH_TAGS });
    });
  }

  deleteSeries(id: string) {
    return this.prisma.series.delete({ where: { id } });
  }

  /** Pins exactly these approved series to the home page, in this order, and unpins every other. */
  setFeatured(ids: string[]) {
    return this.prisma.$transaction([
      this.prisma.series.updateMany({ where: { isFeatured: true, id: { notIn: ids } }, data: { isFeatured: false, featuredOrder: null } }),
      ...ids.map((id, index) => this.prisma.series.update({ where: { id }, data: { isFeatured: true, featuredOrder: index + 1 } })),
    ]);
  }

  /** Which of these ids are series that exist and are shown on the site. */
  async approvedSeriesIds(ids: string[]): Promise<string[]> {
    const rows = await this.prisma.series.findMany({ where: { id: { in: ids }, state: "approved" }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /** Which of these ids are series that exist. */
  async existingSeriesIds(ids: string[]): Promise<string[]> {
    const rows = await this.prisma.series.findMany({ where: { id: { in: ids } }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /**
   * Puts the series on a team (or on none) in one transaction. Their chapters record which team published them, so they
   * move with the series: to the team, or to none when the series is taken off every team.
   */
  transferSeries(ids: string[], teamId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.series.updateMany({ where: { id: { in: ids } }, data: { teamId } });
      const chapters = await tx.chapter.updateMany({ where: { seriesId: { in: ids } }, data: { teamId } });
      return { series: moved.count, chapters: chapters.count };
    });
  }

  /** Removes a series and everything that only makes sense with it: its chapters (pages cascade), comments, favorites and reading progress. */
  deleteSeriesCascade(id: string) {
    return this.prisma.$transaction([
      this.prisma.comment.deleteMany({ where: { seriesId: id } }),
      this.prisma.chapter.deleteMany({ where: { seriesId: id } }),
      this.prisma.bookmark.deleteMany({ where: { seriesId: id } }),
      this.prisma.readingProgress.deleteMany({ where: { seriesId: id } }),
      this.prisma.chapterView.deleteMany({ where: { seriesId: id } }),
      this.prisma.seriesRating.deleteMany({ where: { seriesId: id } }),
      this.prisma.series.delete({ where: { id } }),
    ]);
  }

  // ---- tags ----------------------------------------------------------------

  listTags() {
    return this.prisma.tag.findMany({ orderBy: [{ group: "asc" }, { nameEn: "asc" }] });
  }

  findTagsBySlugs(slugs: string[]) {
    return this.prisma.tag.findMany({ where: { slug: { in: slugs } } });
  }

  createTag(data: { slug: string; nameEn: string; nameAr: string; group: string; legacyId?: string }) {
    return this.prisma.tag.create({ data });
  }

  // ---- teams ---------------------------------------------------------------

  listTeams() {
    return this.prisma.team.findMany({ include: TEAM_INCLUDE, orderBy: { createdAt: "asc" } });
  }

  findTeamBySlug(slug: string) {
    return this.prisma.team.findUnique({ where: { slug }, include: TEAM_INCLUDE });
  }

  findTeamById(id: string) {
    return this.prisma.team.findUnique({ where: { id }, include: TEAM_INCLUDE });
  }

  findTeamByLegacyId(legacyId: string) {
    return this.prisma.team.findUnique({ where: { legacyId }, select: { id: true } });
  }

  teamSlugTaken(slug: string) {
    return this.prisma.team.count({ where: { slug } }).then((n) => n > 0);
  }

  /** Newest published chapter per team, and how many series each team has — for ranking and "last active". */
  async teamActivity() {
    const [chapters, series] = await Promise.all([
      this.prisma.chapter.groupBy({ by: ["teamId"], where: { isPublished: true }, _max: { publishedAt: true, createdAt: true } }),
      this.prisma.series.groupBy({ by: ["teamId"], where: { state: "approved", teamId: { not: null } }, _count: { _all: true }, _sum: { viewCount: true } }),
    ]);
    return { chapters, series };
  }

  createTeam(data: {
    slug: string;
    name: string;
    description: string;
    goals: string;
    color: string;
    logoHue: number;
    discordUrl: string | null;
    websiteUrl: string | null;
    category: string;
    status: string;
    recruiting: boolean;
    leaderId: string | null;
    legacyId?: string;
    createdAt?: Date;
  }) {
    return this.prisma.team.create({ data, include: TEAM_INCLUDE });
  }

  updateTeam(id: string, data: Record<string, unknown>) {
    return this.prisma.team.update({ where: { id }, data, include: TEAM_INCLUDE });
  }

  deleteTeam(id: string) {
    return this.prisma.team.delete({ where: { id } });
  }

  setMember(teamId: string, userId: string, role: string) {
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: { role },
      create: { teamId, userId, role },
    });
  }

  removeMember(teamId: string, userId: string) {
    return this.prisma.teamMember.deleteMany({ where: { teamId, userId } });
  }

  allMembers() {
    return this.prisma.teamMember.findMany({ select: { teamId: true, userId: true, role: true } });
  }

  membersOfTeam(teamId: string) {
    return this.prisma.teamMember.findMany({ where: { teamId }, select: { userId: true, role: true } });
  }

  // ---- chapters ------------------------------------------------------------

  chaptersOfSeries(seriesId: string, includeUnpublished: boolean) {
    return this.prisma.chapter.findMany({
      where: { seriesId, ...(includeUnpublished ? {} : { isPublished: true }) },
      orderBy: { number: "desc" },
      include: { _count: { select: { pages: true } } },
    });
  }

  recentChapters(take: number) {
    return this.prisma.chapter.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take,
      include: { _count: { select: { pages: true } } },
    });
  }

  // ---- news ----------------------------------------------------------------

  listNews(take: number, includeUnpublished = false) {
    return this.prisma.newsItem.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  findNews(id: string) {
    return this.prisma.newsItem.findUnique({ where: { id } });
  }

  createNews(data: { title: string; excerpt: string; content: string; category: string; authorId: string; isPublished: boolean }) {
    return this.prisma.newsItem.create({ data });
  }

  updateNews(id: string, data: Record<string, unknown>) {
    return this.prisma.newsItem.update({ where: { id }, data });
  }

  deleteNews(id: string) {
    return this.prisma.newsItem.delete({ where: { id } });
  }

  findActor(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isBanned: true, bannedUntil: true } });
  }

  async findUserIdByUsername(username: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    return user?.id ?? null;
  }

  // ---- people --------------------------------------------------------------

  findPeople(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({ where: { id: { in: ids }, isBanned: false }, select: PERSON_SELECT });
  }

  /**
   * Readers ranked by experience: every account with a public profile that has earned some. The reading *history* (which
   * works) is a separate, private-by-default setting and does not matter here — the ranking shows only the counters. An
   * account that hides its whole profile stays out.
   */
  async topReaders(take: number): Promise<{ userId: string; total: number }[]> {
    const rows = await this.prisma.$queryRaw<{ userId: string; total: number }[]>`
      SELECT u.id AS "userId", CAST(u.xp AS DOUBLE PRECISION) AS "total"
      FROM users u
      WHERE u."profileVisibility" = 'public' AND u."isBanned" = false AND u.xp > 0
      ORDER BY u.xp DESC, u."chaptersRead" DESC, u."createdAt" ASC
      LIMIT ${take}`;
    return rows;
  }

  /** Headline numbers for the admin overview. */
  async platformCounts() {
    const [members, comments, chapters] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.comment.count({ where: { deletedAt: null } }),
      this.prisma.chapter.count({ where: { isPublished: true } }),
    ]);
    return { members, comments, chapters };
  }

  // ---- imported chapters -----------------------------------------------------

  /** Imported series with the team their chapters will be credited to. */
  async listImportedSeries(): Promise<{ id: string; slug: string; legacyId: string; teamId: string | null }[]> {
    const rows = await this.prisma.series.findMany({
      where: { legacyId: { not: null }, state: "approved" },
      select: { id: true, slug: true, legacyId: true, teamId: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.flatMap((r) => (r.legacyId ? [{ id: r.id, slug: r.slug, legacyId: r.legacyId, teamId: r.teamId }] : []));
  }

  findChapterByLegacyId(legacyId: string) {
    return this.prisma.chapter.findUnique({
      where: { legacyId },
      select: { id: true, isPublished: true, pages: { select: { pageNumber: true } } },
    });
  }

  /** True when a chapter of that series already uses this number (e.g. one uploaded by hand), which the unique index would reject. */
  async chapterNumberTaken(seriesId: string, number: number): Promise<boolean> {
    return (await this.prisma.chapter.count({ where: { seriesId, number } })) > 0;
  }

  /** Imported chapters start unpublished and are published only once every page is stored, so a half-copied chapter is never readable. */
  createImportedChapter(data: { seriesId: string; teamId: string; number: number; title: string; legacyId: string }) {
    return this.prisma.chapter.create({
      // No manual override: an imported chapter follows the automatic rule (the newest few of a series are locked) like any other.
      data: { ...data, isPublished: false },
      select: { id: true },
    });
  }

  addChapterPage(params: {
    chapterId: string;
    pageNumber: number;
    storageKey: string;
    checksum: string;
    mimeType: string;
    width: number;
    height: number;
  }) {
    const { chapterId, pageNumber, ...asset } = params;
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.imageAsset.create({ data: asset, select: { id: true } });
      return tx.chapterPage.create({ data: { chapterId, pageNumber, assetId: created.id }, select: { id: true } });
    });
  }

  publishImportedChapter(id: string, publishedAt: Date) {
    return this.prisma.chapter.update({ where: { id }, data: { isPublished: true, publishedAt }, select: { id: true } });
  }

  // ---- images --------------------------------------------------------------

  findAsset(id: string) {
    return this.prisma.imageAsset.findUnique({ where: { id } });
  }

  createAsset(params: { storageKey: string; checksum: string; mimeType: string; width: number; height: number }) {
    return this.prisma.imageAsset.create({ data: params });
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
