import { Injectable, NotFoundException } from "@nestjs/common";
import { StorageService } from "../images/storage/storage.interface";
import { CatalogRepository } from "./catalog.repository";
import {
  EMPTY_STATS,
  toChapterDto,
  toNewsDto,
  toPersonDto,
  toSeriesDto,
  toTagDto,
  toTeamDto,
  type SeriesRow,
  type TeamRow,
} from "./catalog.util";

const BOOTSTRAP_TTL_MS = 15_000;
const RECENT_CHAPTERS = 60;
const NEWS_ON_BOOTSTRAP = 20;
const TOP_READERS = 10;

type ImageTarget = "series" | "banner" | "team" | "news";

/**
 * The read side of the catalogue. One `bootstrap()` call answers everything the
 * site's pages need to render (series, teams, tags, latest chapters, news), in
 * the same shapes the frontend's mock dataset used, so the UI could switch its
 * data source without changing how it reads it.
 *
 * Deliberately not paginated yet: at a few hundred series the payload is small,
 * and the client-side filtering the explore page does depends on having the list.
 * When the catalogue outgrows that, series pages stay on `seriesDetail()` and the
 * list moves to a paged endpoint.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly storage: StorageService
  ) {}

  private cachedBootstrap?: { at: number; value: ReturnType<CatalogService["bootstrap"]> };

  /**
   * Every page render asks for this, so it is memoised for a few seconds
   * instead of running eight queries each time. Any catalogue write calls
   * invalidate(), so an edit shows up at once for whoever made it.
   */
  bootstrapCached() {
    const now = Date.now();
    if (this.cachedBootstrap && now - this.cachedBootstrap.at < BOOTSTRAP_TTL_MS) return this.cachedBootstrap.value;
    const value = this.bootstrap();
    this.cachedBootstrap = { at: now, value };
    value.catch(() => {
      if (this.cachedBootstrap?.value === value) this.cachedBootstrap = undefined;
    });
    return value;
  }

  invalidate() {
    this.cachedBootstrap = undefined;
  }

  async bootstrap() {
    const [tagRows, teamRows, seriesRows, chapterRows, newsRows, activity, readers] = await Promise.all([
      this.repo.listTags(),
      this.repo.listTeams(),
      this.repo.listApprovedSeries(),
      this.repo.recentChapters(RECENT_CHAPTERS),
      this.repo.listNews(NEWS_ON_BOOTSTRAP),
      this.repo.teamActivity(),
      this.repo.topReaders(TOP_READERS),
    ]);

    const stats = await this.repo.statsFor(seriesRows.map((s) => s.id));
    const teams = this.buildTeams(teamRows, activity);

    const personIds = new Set<string>(readers.map((r) => r.userId));
    for (const team of teamRows) {
      if (team.leaderId) personIds.add(team.leaderId);
      for (const m of team.members) personIds.add(m.userId);
    }
    const people = await this.repo.findPeople([...personIds]);
    const readCounts = new Map(readers.map((r) => [r.userId, Math.round(r.total)]));
    const affiliation = await this.affiliations(teamRows);

    const personDtos = people.map((p) => toPersonDto(p, { ...affiliation.get(p.id), readCount: readCounts.get(p.id) }));

    return {
      tags: tagRows.map(toTagDto),
      teams,
      people: personDtos,
      series: seriesRows.map((s) => toSeriesDto(s as SeriesRow, stats.get(s.id) ?? EMPTY_STATS)),
      recentChapters: chapterRows.map(toChapterDto),
      news: newsRows.map(toNewsDto),
      topReaders: readers.flatMap((r) => {
        const person = personDtos.find((p) => p.id === r.userId);
        return person ? [person] : [];
      }),
    };
  }

  async seriesDetail(slug: string, includeUnpublishedChapters = false) {
    const row = await this.repo.findSeriesBySlug(slug);
    if (!row) throw new NotFoundException({ code: "series_not_found", message: "This series does not exist." });

    const [stats, chapters, teamRow] = await Promise.all([
      this.repo.statsFor([row.id]),
      this.repo.chaptersOfSeries(row.id, includeUnpublishedChapters),
      row.teamId ? this.repo.findTeamById(row.teamId) : Promise.resolve(null),
    ]);

    const activity = await this.repo.teamActivity();
    return {
      series: toSeriesDto(row as SeriesRow, stats.get(row.id) ?? EMPTY_STATS),
      chapters: chapters.map(toChapterDto),
      team: teamRow ? this.buildTeams([teamRow], activity)[0] : null,
    };
  }

  async teamDetail(slug: string) {
    const teamRow = await this.repo.findTeamBySlug(slug);
    if (!teamRow) throw new NotFoundException({ code: "team_not_found", message: "This team does not exist." });

    const [activity, members] = await Promise.all([this.repo.teamActivity(), this.repo.membersOfTeam(teamRow.id)]);
    const ids = [...new Set([...(teamRow.leaderId ? [teamRow.leaderId] : []), ...members.map((m) => m.userId)])];
    const people = await this.repo.findPeople(ids);
    const roles = new Map(members.map((m) => [m.userId, m.role]));

    const seriesRows = (await this.repo.listApprovedSeries()).filter((s) => s.teamId === teamRow.id);
    const stats = await this.repo.statsFor(seriesRows.map((s) => s.id));

    return {
      team: this.buildTeams([teamRow], activity)[0],
      members: people.map((p) =>
        toPersonDto(p, { teamId: teamRow.id, teamRole: p.id === teamRow.leaderId ? "team_leader" : roles.get(p.id) })
      ),
      series: seriesRows.map((s) => toSeriesDto(s as SeriesRow, stats.get(s.id) ?? EMPTY_STATS)),
    };
  }

  /** Bytes of a cover, banner, logo or news picture, or null when the entity has none (the caller answers 404). */
  async image(target: ImageTarget, id: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const assetId = await this.assetIdFor(target, id);
    if (!assetId) return null;
    const asset = await this.repo.findAsset(assetId);
    if (!asset) return null;
    return { data: await this.storage.get(asset.storageKey), mimeType: asset.mimeType };
  }

  private async assetIdFor(target: ImageTarget, id: string): Promise<string | null> {
    if (target === "series" || target === "banner") {
      const series = await this.repo.findSeriesById(id);
      return (target === "series" ? series?.coverAssetId : series?.bannerAssetId) ?? null;
    }
    if (target === "team") return (await this.repo.findTeamById(id))?.logoAssetId ?? null;
    return (await this.repo.findNews(id))?.coverAssetId ?? null;
  }

  /** Teams ranked by how many series they publish, then by views; `rank` is that position. */
  private buildTeams(
    rows: TeamRow[],
    activity: Awaited<ReturnType<CatalogRepository["teamActivity"]>>
  ) {
    const seriesByTeam = new Map(activity.series.map((s) => [s.teamId, { count: s._count._all, views: s._sum.viewCount ?? 0 }]));
    const lastChapter = new Map(activity.chapters.map((c) => [c.teamId, c._max.publishedAt ?? c._max.createdAt ?? null]));

    const ranked = [...rows].sort((a, b) => {
      const sa = seriesByTeam.get(a.id) ?? { count: 0, views: 0 };
      const sb = seriesByTeam.get(b.id) ?? { count: 0, views: 0 };
      return sb.count - sa.count || sb.views - sa.views || a.createdAt.getTime() - b.createdAt.getTime();
    });
    const rankOf = new Map(ranked.map((t, i) => [t.id, i + 1]));

    return rows.map((t) => toTeamDto(t, rankOf.get(t.id) ?? rows.length, lastChapter.get(t.id) ?? null));
  }

  /** Which team each member belongs to and in what role (a leader always reads as team_leader). One query for all teams. */
  private async affiliations(rows: TeamRow[]) {
    const map = new Map<string, { teamId: string; teamRole: string }>();
    for (const m of await this.repo.allMembers()) map.set(m.userId, { teamId: m.teamId, teamRole: m.role });
    for (const team of rows) {
      if (team.leaderId) map.set(team.leaderId, { teamId: team.id, teamRole: "team_leader" });
    }
    return map;
  }
}
