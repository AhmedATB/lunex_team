import type { Catalog, CatalogSeed } from "@/lib/catalog-types";
import { getMockDatabase } from "@/lib/mock/generate";
import type { User } from "@/lib/types";

/** The real catalogue in the shape every page already reads. Collections that no longer exist as data (sample comments, sample kanban boards, ...) are empty. */
export function seedToCatalog(seed: CatalogSeed): Catalog {
  return {
    genres: seed.genres,
    teams: seed.teams,
    users: seed.users,
    series: seed.series,
    // Chapters are fetched per series now; the newest few live in recentChapters for the ticker and the home page.
    chapters: [],
    recentChapters: seed.recentChapters,
    topReaders: seed.topReaders,
    comments: [],
    news: seed.news,
    stats: seed.stats,
    kanbanTasks: [],
    teamCreationRequests: [],
    customRoles: [],
    departments: [],
    seriesAssignments: [],
    teamActivityLog: [],
    recruitmentPositions: [],
    recruitmentApplications: [],
    collaborationRequests: [],
    teamTransferRequests: [],
    leadershipTransferHistory: [],
  };
}

/** The built-in sample data, used only while the database has no series (see loadCatalogSeed). */
export function mockCatalog(): Catalog {
  const mock = getMockDatabase();
  return {
    ...mock,
    recentChapters: [...mock.chapters].sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt)).slice(0, 60),
    topReaders: [...mock.users].sort((a, b) => b.readCount - a.readCount).slice(0, 10),
    stats: { members: mock.users.length, comments: mock.comments.length, chapters: mock.chapters.length },
  };
}

/**
 * Pages look the signed-in person up in `users` to learn their role and team.
 * Real members appear there only if a team or a ranking mentions them, so the
 * account itself is added when it is missing — with the team it leads or belongs to.
 */
export function withSessionUser(
  catalog: Catalog,
  session: { id: string; username: string; displayName: string | null; role: string; email: string; createdAt: string; bio: string | null; avatarVersion: string | null; isBanned: boolean } | null
): Catalog {
  if (!session || catalog.users.some((u) => u.id === session.id)) return catalog;

  const team = catalog.teams.find((t) => t.leaderId === session.id) ?? catalog.teams.find((t) => t.memberIds.includes(session.id));
  const self: User = {
    id: session.id,
    username: session.username,
    displayName: session.displayName ?? session.username,
    avatarSeed: session.id,
    avatarVersion: session.avatarVersion,
    email: session.email,
    role: session.role as User["role"],
    teamId: team?.id,
    teamRole: team ? (team.leaderId === session.id ? "team_leader" : "translator") : undefined,
    level: 1,
    xp: 0,
    xpToNext: 100,
    joinedAt: session.createdAt,
    bio: session.bio ?? "",
    isOnline: true,
    readCount: 0,
    commentCount: 0,
    bookmarkCount: 0,
    badges: [],
    isBanned: session.isBanned,
  };
  return { ...catalog, users: [...catalog.users, self] };
}
