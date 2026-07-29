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
  TeamCategory,
  TeamCreationRequest,
  CustomRole,
  Department,
  DepartmentKind,
  SeriesAssignment,
  SeriesProductionRole,
  TeamActivityLogEntry,
  RecruitmentPosition,
  RecruitmentApplication,
  CollaborationRequest,
  CollaborationType,
  TeamTransferRequest,
  LeadershipTransferEntry,
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
  teamCreationRequests: TeamCreationRequest[];
  customRoles: CustomRole[];
  departments: Department[];
  seriesAssignments: SeriesAssignment[];
  teamActivityLog: TeamActivityLogEntry[];
  recruitmentPositions: RecruitmentPosition[];
  recruitmentApplications: RecruitmentApplication[];
  collaborationRequests: CollaborationRequest[];
  teamTransferRequests: TeamTransferRequest[];
  leadershipTransferHistory: LeadershipTransferEntry[];
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
    "trainee", "member", "translator", "editor", "proofreader",
    "qc", "publisher", "uploader", "reviewer",
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

  const teamCategories: TeamCategory[] = ["manhwa", "manhwa", "manhwa", "manhua", "manga", "mixed"];
  // Draw from one shared, shrinking pool so no user ends up in more than one team's
  // memberIds — a user's `teamId`/`teamRole` are single fields, and if the same id
  // appeared in two teams the later team in this list would silently overwrite them.
  let availableUserIds = rng.shuffle(users.map((u) => u.id));
  const teams: Team[] = TEAM_NAMES.slice(0, TEAM_COUNT).map((name, i) => {
    const size = Math.min(rng.int(6, 14), availableUserIds.length);
    const memberIds = availableUserIds.slice(0, size);
    availableUserIds = availableUserIds.slice(size);
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
      category: rng.pick(teamCategories),
      goals: `نسعى ليصبح فريق ${name} من أفضل فرق الترجمة عربياً من ناحية الجودة والانتظام بالنشر.`,
      status: rng.bool(0.92) ? "active" : rng.pick(["suspended", "archived"] as const),
      lastActivityAt: daysAgo(rng.int(0, 20)),
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

  // --- Custom roles: 1-2 per team, layered on top of the fixed TeamRole defaults ---
  const CUSTOM_ROLE_TEMPLATES: { name: string; nameAr: string; permissions: import("../types").TeamPermission[] }[] = [
    { name: "Senior Translator", nameAr: "مترجم أول", permissions: ["upload_chapter", "edit_chapter", "assign_workers"] },
    { name: "Chapter Publisher", nameAr: "ناشر الفصول", permissions: ["publish_chapter", "schedule_release"] },
    { name: "Event Manager", nameAr: "منظم الفعاليات", permissions: ["invite_members", "view_team_statistics"] },
    { name: "Temporary QC", nameAr: "مراقب جودة مؤقت", permissions: ["edit_chapter"] },
  ];
  const customRoles: CustomRole[] = teams.flatMap((team) =>
    rng.pickMany(CUSTOM_ROLE_TEMPLATES, rng.int(1, 2)).map((tpl, i) => ({
      id: `custom-role-${team.id}-${i + 1}`,
      teamId: team.id,
      name: tpl.name,
      nameAr: tpl.nameAr,
      color: TEAM_COLORS[rng.int(0, TEAM_COLORS.length - 1)],
      permissions: tpl.permissions,
      isDefault: false,
      createdAt: daysAgo(rng.int(30, 400)),
    }))
  );
  // Sprinkle a custom role onto a couple of non-leader members per team.
  for (const team of teams) {
    const roles = customRoles.filter((r) => r.teamId === team.id);
    const candidates = team.memberIds.slice(2);
    for (const uid of rng.pickMany(candidates, Math.min(candidates.length, rng.int(1, 2)))) {
      const user = users.find((u) => u.id === uid);
      if (user && roles.length > 0) user.customRoleId = rng.pick(roles).id;
    }
  }

  // --- Departments ---
  const DEPARTMENT_KINDS: { kind: DepartmentKind; name: string; nameAr: string }[] = [
    { kind: "translation", name: "Translation", nameAr: "الترجمة" },
    { kind: "editing", name: "Editing", nameAr: "التحرير" },
    { kind: "proofreading", name: "Proofreading", nameAr: "التدقيق اللغوي" },
    { kind: "quality_control", name: "Quality Control", nameAr: "مراقبة الجودة" },
    { kind: "publishing", name: "Publishing", nameAr: "النشر" },
    { kind: "media", name: "Media", nameAr: "الإعلام" },
    { kind: "recruitment", name: "Recruitment", nameAr: "التوظيف" },
  ];
  const ROLE_TO_DEPARTMENT: Partial<Record<TeamRole, DepartmentKind>> = {
    translator: "translation",
    editor: "editing",
    proofreader: "proofreading",
    qc: "quality_control",
    publisher: "publishing",
    recruiter: "recruitment",
  };
  const departments: Department[] = teams.flatMap((team) => {
    const picked = rng.pickMany(DEPARTMENT_KINDS, rng.int(4, 7));
    return picked.map((d, i) => {
      const memberIds = team.memberIds.filter((uid) => {
        const u = users.find((x) => x.id === uid);
        return u?.teamRole && ROLE_TO_DEPARTMENT[u.teamRole] === d.kind;
      });
      return {
        id: `dept-${team.id}-${i + 1}`,
        teamId: team.id,
        kind: d.kind,
        name: d.name,
        nameAr: d.nameAr,
        leaderId: memberIds[0] ?? (rng.bool(0.5) ? team.leaderId : undefined),
        memberIds,
      };
    });
  });

  // --- Per-series production assignments (who works on this specific title) ---
  const PRODUCTION_ROLES: SeriesProductionRole[] = [
    "translator", "editor", "proofreader", "qc", "publisher",
  ];
  const seriesAssignments: SeriesAssignment[] = [];
  let assignmentCounter = 1;
  for (const s of series) {
    const team = teams.find((t) => t.id === s.teamId);
    if (!team) continue;
    for (const prodRole of PRODUCTION_ROLES) {
      const teamRoleForSlot: TeamRole = prodRole;
      const candidates = team.memberIds.filter((uid) => users.find((u) => u.id === uid)?.teamRole === teamRoleForSlot);
      if (candidates.length === 0 || !rng.bool(0.75)) continue;
      seriesAssignments.push({
        id: `assign-${assignmentCounter++}`,
        seriesId: s.id,
        userId: rng.pick(candidates),
        role: prodRole,
        assignedAt: daysAgo(rng.int(5, 300)),
        assignedBy: team.leaderId,
      });
    }
  }

  // --- Team activity log ---
  const ACTIVITY_ACTIONS = [
    "أضاف عضواً جديداً للفريق",
    "أزال عضواً من الفريق",
    "غيّر دور عضو",
    "عدّل صلاحيات دور",
    "نشر فصلاً جديداً",
    "أنشأ مشروعاً جديداً",
    "قبل طلب تعاون من فريق آخر",
    "نقل قيادة الفريق",
  ];
  const teamActivityLog: TeamActivityLogEntry[] = teams.flatMap((team) =>
    Array.from({ length: rng.int(12, 20) }).map((_, i) => ({
      id: `activity-${team.id}-${i + 1}`,
      teamId: team.id,
      userId: rng.pick(team.memberIds),
      action: rng.pick(ACTIVITY_ACTIONS),
      target: rng.bool(0.5) ? rng.pick(users).displayName : undefined,
      previousValue: rng.bool(0.3) ? "عضو" : undefined,
      newValue: rng.bool(0.3) ? "مترجم أول" : undefined,
      at: daysAgo(rng.int(0, 180)),
    }))
  );

  // --- Recruitment ---
  const RECRUIT_ROLES: TeamRole[] = ["translator", "editor", "proofreader", "qc", "publisher"];
  const recruitmentPositions: RecruitmentPosition[] = teams
    .filter((t) => t.recruiting)
    .flatMap((team) =>
      rng.pickMany(RECRUIT_ROLES, rng.int(2, 3)).map((role, i) => ({
        id: `position-${team.id}-${i + 1}`,
        teamId: team.id,
        role,
        isOpen: true,
        description: `نبحث عن ${role} ملتزم وموهوب للانضمام إلى فريق ${team.name}.`,
        createdAt: daysAgo(rng.int(1, 60)),
      }))
    );
  const APPLICATION_LANGUAGES = ["العربية", "الإنجليزية", "الكورية", "اليابانية"];
  const nonMemberUsers = users.filter((u) => !u.teamId);
  const recruitmentApplications: RecruitmentApplication[] = recruitmentPositions.flatMap((pos, idx) => {
    const applicantCount = rng.int(0, 4);
    return rng.pickMany(nonMemberUsers, applicantCount).map((applicant, i) => ({
      id: `application-${pos.id}-${i + 1}`,
      teamId: pos.teamId,
      positionId: pos.id,
      userId: applicant.id,
      preferredRole: pos.role,
      experience: rng.pick([
        "بدون خبرة سابقة لكن شغوف بالتعلم",
        "سنة خبرة في فرق ترجمة أخرى",
        "أكثر من سنتين خبرة في الترجمة والتنسيق",
      ]),
      portfolioUrl: rng.bool(0.4) ? "https://example.com/portfolio" : undefined,
      languages: rng.pickMany(APPLICATION_LANGUAGES, rng.int(1, 3)),
      availability: rng.pick(["جزئي (أقل من 10 ساعات أسبوعياً)", "متوسط (10-20 ساعة أسبوعياً)", "كامل (أكثر من 20 ساعة أسبوعياً)"]),
      status: rng.pick(["pending", "pending", "accepted", "rejected", "interview", "waitlist"] as const),
      appliedAt: daysAgo(rng.int(0, 45) + idx * 0),
    }));
  });

  // --- Cross-team collaboration requests ---
  const COLLAB_TYPES: CollaborationType[] = [
    "need_translator", "need_editor", "need_proofreader", "need_qc", "need_publisher",
    "need_complete_team_support", "emergency_assistance",
  ];
  const collaborationRequests: CollaborationRequest[] = Array.from({ length: 16 }).map((_, i) => {
    const fromTeam = rng.pick(teams);
    let toTeam = rng.pick(teams);
    while (toTeam.id === fromTeam.id) toTeam = rng.pick(teams);
    const ownedSeries = series.filter((s) => s.teamId === fromTeam.id);
    const s = ownedSeries.length > 0 ? rng.pick(ownedSeries) : rng.pick(series);
    return {
      id: `collab-${i + 1}`,
      fromTeamId: fromTeam.id,
      toTeamId: toTeam.id,
      seriesId: s.id,
      type: rng.pick(COLLAB_TYPES),
      message: `نحتاج دعم فريقكم على مشروع ${s.titleAr}، هل يمكنكم المساعدة؟`,
      status: rng.pick(["pending", "pending", "accepted", "rejected", "negotiating"] as const),
      createdAt: daysAgo(rng.int(0, 40)),
    };
  });

  // --- Team creation requests (admin approval queue) ---
  const PENDING_TEAM_NAMES = ["Nova Scans", "Ashfall", "Crescent Ink", "Ember Team", "Void Studio"];
  const requesters = rng.pickMany(nonMemberUsers, PENDING_TEAM_NAMES.length);
  const teamCreationStatuses: TeamCreationRequest["status"][] = [
    "pending", "pending", "pending", "approved", "rejected", "needs_modification",
  ];
  const teamCreationRequests: TeamCreationRequest[] = PENDING_TEAM_NAMES.map((name, i) => {
    const status = teamCreationStatuses[i % teamCreationStatuses.length];
    const requester = requesters[i] ?? rng.pick(users);
    return {
      id: `team-request-${i + 1}`,
      requesterId: requester.id,
      teamName: name,
      logoSeed: `lunex-team-request-logo-${i + 1}`,
      bannerSeed: `lunex-team-request-banner-${i + 1}`,
      description: `فريق ${name} فريق ناشئ يطمح لتقديم ترجمات عالية الجودة للقرّاء العرب.`,
      goals: "نشر فصل واحد أسبوعياً على الأقل مع الحفاظ على جودة الترجمة والتنسيق.",
      discordUrl: "https://discord.gg/example",
      requiredPositions: rng.pickMany(RECRUIT_ROLES, rng.int(2, 4)),
      category: rng.pick(teamCategories),
      expectedMembers: rng.int(5, 20),
      previousExperience: rng.pick([
        "أعضاء الفريق عملوا سابقاً في فرق ترجمة معروفة",
        "فريق جديد بالكامل بدون خبرة مسبقة",
        "بعض الأعضاء لديهم خبرة فردية في الترجمة الحرة",
      ]),
      portfolioUrl: rng.bool(0.5) ? "https://example.com/portfolio" : undefined,
      status,
      reviewerNote: status === "needs_modification" ? "يرجى توضيح خطة النشر الأسبوعية بشكل أدق." : undefined,
      reviewedBy: status !== "pending" ? teams[0]?.leaderId : undefined,
      reviewedAt: status !== "pending" ? daysAgo(rng.int(1, 20)) : undefined,
      createdAt: daysAgo(rng.int(2, 60)),
    };
  });

  // --- Team transfer + leadership transfer history ---
  const teamTransferRequests: TeamTransferRequest[] = Array.from({ length: 6 }).map((_, i) => {
    const user = rng.pick(users.filter((u) => u.teamId));
    const fromTeam = teams.find((t) => t.id === user.teamId) ?? rng.pick(teams);
    let toTeam = rng.pick(teams);
    while (toTeam.id === fromTeam.id) toTeam = rng.pick(teams);
    return {
      id: `transfer-${i + 1}`,
      userId: user.id,
      fromTeamId: fromTeam.id,
      toTeamId: toTeam.id,
      reason: "يبحث عن فرصة أفضل تناسب وقته وتخصصه.",
      status: rng.pick(["pending", "current_team_approved", "new_team_approved", "approved", "rejected"] as const),
      createdAt: daysAgo(rng.int(0, 60)),
    };
  });

  const leadershipTransferHistory: LeadershipTransferEntry[] = teams
    .filter(() => rng.bool(0.4))
    .map((team, i) => ({
      id: `leadership-transfer-${i + 1}`,
      teamId: team.id,
      fromUserId: team.leaderId,
      toUserId: rng.pick(team.memberIds),
      reason: "تفرغ القائد السابق عن الفريق لظروف شخصية.",
      at: daysAgo(rng.int(60, 500)),
    }));

  return {
    genres,
    teams,
    users,
    series,
    chapters,
    comments,
    news,
    kanbanTasks,
    teamCreationRequests,
    customRoles,
    departments,
    seriesAssignments,
    teamActivityLog,
    recruitmentPositions,
    recruitmentApplications,
    collaborationRequests,
    teamTransferRequests,
    leadershipTransferHistory,
  };
}

let cached: MockDatabase | null = null;

export function getMockDatabase(): MockDatabase {
  if (!cached) cached = build();
  return cached;
}
