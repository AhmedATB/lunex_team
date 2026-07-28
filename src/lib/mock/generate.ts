import { Rand } from "./rng";
import {
  GENRES,
  TITLE_PREFIXES,
  TITLE_CORES,
  AUTHORS,
  TEAM_NAMES,
  TEAM_COLORS,
  USER_FIRST_NAMES,
  USER_LAST_NAMES,
  COMMENT_SNIPPETS,
  NEWS_ITEMS,
} from "./catalog";
import type {
  Genre,
  Team,
  User,
  Series,
  Chapter,
  Comment,
  NewsItem,
  GlobalRole,
  TeamRole,
  KanbanTask,
} from "../types";

const SEED = 1337;
const USER_COUNT = 100;
const SERIES_COUNT = 100;
const CHAPTER_TARGET = 500;
const TEAM_COUNT = 8;

// Anchored to a single timestamp per build() run (not `new Date()` per call) so that
// items sharing the same day-offset get byte-identical timestamps. Otherwise sort-order
// ties would resolve differently between the server render and the client hydration
// pass (each capturing "now" at a slightly different instant), causing a hydration
// mismatch anywhere the data is sorted by these timestamps (e.g. the ticker).
function makeDaysAgo(referenceNow: number) {
  return function daysAgo(n: number) {
    return new Date(referenceNow - n * 86_400_000).toISOString();
  };
}

const NON_SLUG_CHARS = /[^\w\s؀-ۿ-]/g;

function slugify(s: string, fallback: string) {
  const base = s
    .toString()
    .trim()
    .toLowerCase()
    // Keep ASCII word chars and Arabic letters/diacritics (U+0600-U+06FF); drop everything else.
    .replace(NON_SLUG_CHARS, "")
    .replace(/\s+/g, "-");
  return base || fallback;
}

interface MockDatabase {
  genres: Genre[];
  teams: Team[];
  users: User[];
  series: Series[];
  chapters: Chapter[];
  comments: Comment[];
  news: NewsItem[];
  kanbanTasks: KanbanTask[];
}

function build(): MockDatabase {
  const rng = new Rand(SEED);
  const daysAgo = makeDaysAgo(Date.now());

  const genres: Genre[] = GENRES.map((g, i) => ({ id: `genre-${i + 1}`, ...g }));

  const globalRolesPool: GlobalRole[] = [
    ...Array(60).fill("reader"),
    ...Array(15).fill("verified_member"),
    ...Array(8).fill("uploader"),
    ...Array(5).fill("moderator"),
    ...Array(3).fill("editor"),
    ...Array(2).fill("news_manager"),
    ...Array(2).fill("global_team_manager"),
    ...Array(2).fill("support"),
    ...Array(2).fill("super_administrator"),
    ...Array(1).fill("owner"),
  ] as GlobalRole[];

  const teamRolePool: TeamRole[] = [
    "trainee", "member", "translator", "proofreader", "cleaner",
    "redrawer", "typesetter", "qc", "publisher", "uploader", "reviewer",
  ];

  const users: User[] = Array.from({ length: USER_COUNT }).map((_, i) => {
    const first = rng.pick(USER_FIRST_NAMES);
    const last = rng.pick(USER_LAST_NAMES);
    const username = `${slugify(first, "user")}${i + 1}`;
    const role = globalRolesPool[i % globalRolesPool.length];
    const xp = rng.int(0, 12000);
    return {
      id: `user-${i + 1}`,
      username,
      displayName: `${first} ${last}`,
      avatarSeed: username,
      email: `${username}@lunexteam.demo`,
      role,
      level: Math.floor(xp / 500) + 1,
      xp: xp % 500,
      xpToNext: 500,
      joinedAt: daysAgo(rng.int(10, 900)),
      bio: "قارئ شغوف بالمانهوا والقصص الخيالية.",
      isOnline: rng.bool(0.25),
      readCount: rng.int(5, 4000),
      commentCount: rng.int(0, 300),
      bookmarkCount: rng.int(0, 120),
      badges: rng.pickMany(["مترجم متميز", "قارئ نشيط", "عضو مؤسس", "صياد الأخطاء", "داعم الفريق"], rng.int(0, 3)),
    };
  });

  const teams: Team[] = TEAM_NAMES.slice(0, TEAM_COUNT).map((name, i) => {
    const memberIds = rng.pickMany(users.map((u) => u.id), rng.int(6, 14));
    const leaderId = memberIds[0] ?? users[i].id;
    return {
      id: `team-${i + 1}`,
      slug: slugify(name, `team-${i + 1}`),
      name,
      logoHue: rng.int(250, 300),
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      description: `فريق ${name} لترجمة وتنسيق المانهوا الكورية بجودة عالية واحترافية.`,
      leaderId,
      memberIds,
      discordUrl: "https://discord.gg/lunexteam",
      websiteUrl: undefined,
      rank: i + 1,
      recruiting: rng.bool(0.5),
      createdAt: daysAgo(rng.int(200, 1000)),
    };
  });

  // Assign team roles to some users based on team membership
  for (const team of teams) {
    team.memberIds.forEach((uid, idx) => {
      const user = users.find((u) => u.id === uid);
      if (!user) return;
      user.teamId = team.id;
      user.teamRole = idx === 0 ? "team_leader" : idx === 1 ? "assistant_leader" : rng.pick(teamRolePool);
    });
  }

  const statuses: Series["status"][] = ["ongoing", "ongoing", "ongoing", "completed", "hiatus", "dropped"];
  const types: Series["type"][] = ["manhwa", "manhwa", "manhwa", "manhua", "manga", "novel"];
  const countries: Series["country"][] = ["kr", "kr", "kr", "cn", "jp"];

  const usedSlugs = new Set<string>();
  const series: Series[] = Array.from({ length: SERIES_COUNT }).map((_, i) => {
    const prefix = rng.pick(TITLE_PREFIXES);
    const core = rng.pick(TITLE_CORES);
    const titleAr = `${prefix} ${core}`;
    let slug = slugify(titleAr, `series-${i + 1}`);
    while (usedSlugs.has(slug)) slug = `${slug}-${i + 1}`;
    usedSlugs.add(slug);

    const team = rng.pick(teams);
    const status = rng.pick(statuses);
    const chapterCount = status === "completed" ? rng.int(40, 120) : rng.int(8, 90);
    const views = rng.int(5000, 4_500_000);
    const seedNum = i + 1;

    return {
      id: `series-${seedNum}`,
      slug,
      title: core,
      titleAr,
      alternativeTitles: [core],
      cover: `https://picsum.photos/seed/lunex-cover-${seedNum}/480/680`,
      banner: `https://picsum.photos/seed/lunex-banner-${seedNum}/1600/500`,
      synopsis:
        "في عالم يحكمه القوة والدهاء، يخوض بطلنا رحلة صعود مليئة بالتحديات والمؤامرات، باحثاً عن الانتقام والمجد في آنٍ واحد. هل سيتمكن من كسر قيوده والوصول إلى القمة؟",
      type: rng.pick(types),
      status,
      country: rng.pick(countries),
      author: rng.pick(AUTHORS),
      artist: rng.pick(AUTHORS),
      year: rng.int(2015, 2025),
      rating: rng.float(6.5, 9.9),
      ratingCount: rng.int(50, 20000),
      views,
      bookmarks: Math.floor(views / rng.int(15, 40)),
      likes: Math.floor(views / rng.int(20, 60)),
      genreIds: rng.pickMany(genres.map((g) => g.id), rng.int(2, 5)),
      tags: rng.pickMany(
        ["قوي منذ البداية", "بطل ذكي", "نظام", "انتقام", "أكاديمية", "عالم موازي", "أبراج", "حصري"],
        rng.int(1, 4)
      ),
      teamId: team.id,
      chapterCount,
      latestChapterNumber: chapterCount,
      updatedAt: daysAgo(rng.int(0, 30)),
      isFeatured: rng.bool(0.12),
      isRecommended: rng.bool(0.2),
    };
  });

  // Distribute ~500 chapters across series proportionally to each series' chapterCount, capped.
  const chapters: Chapter[] = [];
  let chapterIdCounter = 1;
  const totalWeight = series.reduce((sum, s) => sum + s.chapterCount, 0);
  for (const s of series) {
    const share = Math.max(1, Math.round((s.chapterCount / totalWeight) * CHAPTER_TARGET));
    const count = Math.min(s.chapterCount, share);
    for (let c = 0; c < count; c++) {
      const number = s.latestChapterNumber - c;
      if (number < 1) break;
      chapters.push({
        id: `chapter-${chapterIdCounter++}`,
        seriesId: s.id,
        number,
        title: `الفصل ${number}`,
        pages: rng.int(18, 45),
        releasedAt: daysAgo(c * rng.int(3, 8)),
        views: rng.int(200, 90000),
        isPublished: true,
        teamId: s.teamId,
      });
    }
  }

  const comments: Comment[] = Array.from({ length: 260 }).map((_, i) => {
    const s = rng.pick(series);
    return {
      id: `comment-${i + 1}`,
      seriesId: s.id,
      userId: rng.pick(users).id,
      content: rng.pick(COMMENT_SNIPPETS),
      likes: rng.int(0, 400),
      dislikes: rng.int(0, 20),
      createdAt: daysAgo(rng.int(0, 60)),
      isPinned: rng.bool(0.05),
    };
  });

  const news: NewsItem[] = NEWS_ITEMS.map((n, i) => ({
    id: `news-${i + 1}`,
    title: n.title,
    excerpt: "تفاصيل كاملة داخل المقال، تابعوا آخر الأخبار والفعاليات الخاصة بفريق LUNEX TEAM.",
    cover: `https://picsum.photos/seed/lunex-news-${i + 1}/800/450`,
    category: n.category,
    createdAt: daysAgo(rng.int(0, 45)),
    authorId: rng.pick(users).id,
  }));

  const stages: KanbanTask["stage"][] = [
    "pending", "assigned", "in_progress", "review", "qc", "ready_to_publish", "published",
  ];
  const kanbanTasks: KanbanTask[] = Array.from({ length: 60 }).map((_, i) => {
    const s = rng.pick(series);
    const team = teams.find((t) => t.id === s.teamId) ?? rng.pick(teams);
    return {
      id: `task-${i + 1}`,
      seriesId: s.id,
      chapterNumber: s.latestChapterNumber + rng.int(1, 3),
      stage: rng.pick(stages),
      assigneeId: rng.bool(0.8) ? rng.pick(team.memberIds) : undefined,
      priority: rng.pick(["low", "medium", "high", "urgent"] as const),
      deadline: daysAgo(-rng.int(1, 10)),
      teamId: team.id,
    };
  });

  return { genres, teams, users, series, chapters, comments, news, kanbanTasks };
}

let cached: MockDatabase | null = null;

export function getMockDatabase(): MockDatabase {
  if (!cached) cached = build();
  return cached;
}
