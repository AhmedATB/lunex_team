import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { isEffectivelyBanned } from "../moderation/moderation.util";
import { TEAM_LEAD_ROLES } from "./catalog.util";
import { CatalogRepository } from "./catalog.repository";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const WEEKS = 8;
const TEAM_WINDOW_DAYS = 30;
const TEAM_BARS = 6;
const RECENT_WINDOW_DAYS = 14;
const RECENT_EVENTS = 8;
const NO_TEAM = "بدون فريق";

export type ActivityKind = "chapter" | "series" | "member";

export interface DashboardDto {
  /** Chapters published in each of the last eight weeks, oldest first (each week ends where the next begins; the last ends now). */
  weeks: { start: string; chapters: number }[];
  /** Chapters published in the last thirty days, by team (the busiest few). */
  teams: { name: string; chapters: number }[];
  /** The newest things that happened on the site, newest first. */
  recent: { kind: ActivityKind; text: string; at: string }[];
}

/** "نُشر الفصل 20 من X", or, when several of one work went up the same day, "نُشرت الفصول 13–20 (8) من X". */
function chapterText(numbers: number[], title: string): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length === 1) return `نُشر الفصل ${sorted[0]} من ${title}`;
  return `نُشرت الفصول ${sorted[0]}–${sorted[sorted.length - 1]} (${sorted.length}) من ${title}`;
}

/**
 * What the admin overview shows: chapters published per week, per team, and what has just happened. Worked out from the database
 * itself — the overview used to count the catalogue's short "latest chapters" list, which left the real site's charts empty. For staff
 * and for people who hold an office in a team (the same people the page is open to).
 */
@Injectable()
export class CatalogDashboardService {
  constructor(private readonly repo: CatalogRepository) {}

  async dashboard(actorId: string, now: Date = new Date()): Promise<DashboardDto> {
    const actor = await this.repo.findActor(actorId);
    if (!actor) throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    if (isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account has been banned." });
    if (actor.role === "reader" && !(await this.repo.holdsTeamOffice(actorId, [...TEAM_LEAD_ROLES]))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot view the statistics." });
    }

    const nowMs = now.getTime();
    const [dates, perTeam, latest, series, members] = await Promise.all([
      this.repo.publishedChapterDatesSince(new Date(nowMs - WEEKS * WEEK_MS)),
      this.repo.chaptersPerTeamSince(new Date(nowMs - TEAM_WINDOW_DAYS * DAY_MS)),
      this.repo.publishedChaptersSince(new Date(nowMs - RECENT_WINDOW_DAYS * DAY_MS)),
      this.repo.newestSeries(3),
      this.repo.newestMembers(3),
    ]);

    const weeks = Array.from({ length: WEEKS }, (_, i) => {
      const end = nowMs - (WEEKS - 1 - i) * WEEK_MS;
      const start = end - WEEK_MS;
      return { start: new Date(start).toISOString(), chapters: dates.filter((d) => d.getTime() >= start && d.getTime() < end).length };
    });

    const teamNames = await this.repo.teamNames(perTeam.map((t) => t.teamId).filter((id): id is string => id !== null));
    const teams = perTeam
      .map((t) => ({ name: t.teamId ? (teamNames.get(t.teamId) ?? NO_TEAM) : NO_TEAM, chapters: t.chapters }))
      .sort((a, b) => b.chapters - a.chapters)
      .slice(0, TEAM_BARS);

    // Chapters of one work published the same day are one event, not eight.
    const titles = await this.repo.seriesTitles([...new Set(latest.map((c) => c.seriesId))]);
    const groups = new Map<string, { seriesId: string; numbers: number[]; at: Date }>();
    for (const c of latest) {
      const key = `${c.seriesId}:${c.publishedAt.toISOString().slice(0, 10)}`;
      const group = groups.get(key);
      if (group) {
        group.numbers.push(c.number);
        if (c.publishedAt > group.at) group.at = c.publishedAt;
      } else {
        groups.set(key, { seriesId: c.seriesId, numbers: [c.number], at: c.publishedAt });
      }
    }

    const recent = [
      ...[...groups.values()].map((g) => ({ kind: "chapter" as const, text: chapterText(g.numbers, titles.get(g.seriesId) ?? ""), at: g.at })),
      ...series.map((s) => ({ kind: "series" as const, text: `أُضيف عمل جديد: ${s.titleAr || s.titleEn}`, at: s.createdAt })),
      ...members.map((m) => ({ kind: "member" as const, text: `انضم عضو جديد: ${m.displayName ?? m.username}`, at: m.createdAt })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, RECENT_EVENTS)
      .map((e) => ({ ...e, at: e.at.toISOString() }));

    return { weeks, teams, recent };
  }
}
