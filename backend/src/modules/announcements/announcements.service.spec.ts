import type { ConfigService } from "@nestjs/config";
import type { AnnouncementsRepository } from "./announcements.repository";
import { AnnouncementsService } from "./announcements.service";

const HOOK = "https://discord.com/api/webhooks/123/abc";
const SERIES_HOOK = "https://discord.com/api/webhooks/456/def";
const CHAPTER_ROLE = "1472481779662196736";
const SERIES_ROLE = "1474536152697671874";
const TELEGRAM = { TELEGRAM_BOT_TOKEN: "123:token", TELEGRAM_CHAT_ID: "@lunex" };

const TEAM_HOOK = "https://discord.com/api/webhooks/789/team-server";

type WaitingRow = { kind: string; seriesId: string; numbers: number[]; dueAt: Date };

function build(
  settings: Record<string, string> = {},
  options: {
    published?: number[];
    state?: string;
    synopsis?: string;
    genres?: string[];
    thumbnail?: { id: string; thumbnailAssetId: string };
    teamChapterWebhook?: string | null;
    teamSeriesWebhook?: string | null;
    teamRoleId?: string | null;
    /** What is saved as waiting; pass the same one to a second service to play a restart. */
    store?: Map<string, WaitingRow>;
  } = {}
) {
  const store = options.store ?? new Map<string, WaitingRow>();
  const repo = {
    findSeries: jest.fn(async () => ({
      id: "s1",
      slug: "moon-rose",
      state: options.state ?? "approved",
      titleAr: "وردة القمر",
      titleEn: "Moon Rose",
      synopsis: options.synopsis ?? "قصة   طويلة\nعن وردة",
      updatedAt: new Date("2026-09-20T00:00:00Z"),
      coverAssetId: "a1",
      teamId: "t1",
    })),
    teamName: jest.fn(async () => "Nova & Co"),
    genres: jest.fn(async () => options.genres ?? ["خيالي", "دراما"]),
    stillPublished: jest.fn(async (_id: string, numbers: number[]) => options.published ?? [...numbers].sort((a, b) => a - b)),
    latestThumbnail: jest.fn(async () => options.thumbnail ?? null),
    savePending: jest.fn(async (kind: string, seriesId: string, numbers: number[], dueAt: Date) => {
      store.set(`${kind}:${seriesId}`, { kind, seriesId, numbers: [...numbers], dueAt: store.get(`${kind}:${seriesId}`)?.dueAt ?? dueAt }); // the first due time is kept, like the real one
    }),
    clearPending: jest.fn(async (kind: string, seriesId: string) => {
      store.delete(`${kind}:${seriesId}`);
    }),
    pendingAnnouncements: jest.fn(async () => [...store.values()]),
    // The two webhooks are independent — this mirrors the real repository picking the column for `kind`.
    teamDiscord: jest.fn(async (_teamId: string, kind: "chapter" | "series") => {
      const url = kind === "chapter" ? options.teamChapterWebhook : options.teamSeriesWebhook;
      return url ? { webhookUrl: url, roleId: options.teamRoleId ?? null } : null;
    }),
  };
  const config = { get: (key: string) => ({ FRONTEND_URL: "https://lunexteam.com/", ...settings })[key] } as unknown as ConfigService;
  return { service: new AnnouncementsService(repo as unknown as AnnouncementsRepository, config), repo, store };
}

let fetchMock: jest.SpyInstance;
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
const calls = (needle: string) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(needle));

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
});
afterEach(() => {
  jest.useRealTimers();
  fetchMock.mockRestore();
});

/** Publishes, lets the batching window pass and the queue run. */
async function publishAndWait(service: AnnouncementsService, seriesId: string, ...numbers: number[]) {
  for (const n of numbers) service.chapterPublished(seriesId, n);
  const done = service.flush(seriesId);
  await jest.advanceTimersByTimeAsync(5_000);
  await done;
}

describe("announcing a chapter", () => {
  it("does nothing on Discord and Telegram without their settings, but still tells the search engines", async () => {
    const { service } = build();
    await publishAndWait(service, "s1", 7);
    expect(calls("discord.com")).toHaveLength(0);
    expect(calls("api.telegram.org")).toHaveLength(0);
    const [ping] = calls("indexnow");
    expect(bodyOf(ping)).toMatchObject({
      host: "lunexteam.com",
      key: "0dfe21d467149da7cb31f2051b4a298c",
      keyLocation: "https://lunexteam.com/0dfe21d467149da7cb31f2051b4a298c.txt",
      urlList: ["https://lunexteam.com/series/moon-rose/7", "https://lunexteam.com/series/moon-rose"],
    });
  });

  it("posts an embed to the Discord chapters room: the chapter, the work, its cover, the team — and pings the chapters role, only that role", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK });
    await publishAndWait(service, "s1", 7);
    const [post] = calls("discord.com");
    expect(String(post[0])).toBe(HOOK);
    const body = bodyOf(post);
    expect(body.content).toBe(`<@&${CHAPTER_ROLE}>`);
    expect(body.allowed_mentions).toEqual({ parse: [], roles: [CHAPTER_ROLE] });
    expect(body.embeds[0]).toMatchObject({
      title: "الفصل 7 — وردة القمر",
      url: "https://lunexteam.com/series/moon-rose/7",
      description: "قصة طويلة عن وردة",
      thumbnail: { url: `https://lunexteam.com/api/catalog/series/s1/cover?v=${new Date("2026-09-20T00:00:00Z").getTime()}` },
      footer: { text: "الفريق: Nova & Co" },
    });
  });

  it("shows the chapter's own featured picture large in Discord, and sends it to Telegram in place of the cover", async () => {
    const thumbnail = { id: "c7", thumbnailAssetId: "abcdef12-3456" };
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK, ...TELEGRAM }, { thumbnail });
    await publishAndWait(service, "s1", 7);
    const picture = "https://lunexteam.com/api/catalog/chapters/c7/thumbnail?v=abcdef12";
    expect(bodyOf(calls("discord.com")[0]).embeds[0]).toMatchObject({ image: { url: picture }, thumbnail: { url: expect.stringContaining("/series/s1/cover") } });
    expect(bodyOf(calls("/sendPhoto")[0]).photo).toBe(picture);

    fetchMock.mockClear();
    const plain = build({ DISCORD_WEBHOOK_URL: HOOK, ...TELEGRAM });
    await publishAndWait(plain.service, "s1", 7);
    expect(bodyOf(calls("discord.com")[0]).embeds[0].image).toBeUndefined();
    expect(bodyOf(calls("/sendPhoto")[0]).photo).toContain("/series/s1/cover");
  });

  it("also posts to the work's own team server when the team set a webhook — the same embed, pinging no one when it set no role", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK }, { teamChapterWebhook: TEAM_HOOK });
    await publishAndWait(service, "s1", 7);
    const posts = calls("discord.com");
    expect(posts.map((p) => String(p[0])).sort()).toEqual([HOOK, TEAM_HOOK].sort());
    const teamPost = posts.find((p) => String(p[0]) === TEAM_HOOK);
    const teamBody = bodyOf(teamPost!);
    expect(teamBody.content).toBeUndefined();
    expect(teamBody.allowed_mentions).toEqual({ parse: [] });
    expect(teamBody.embeds[0]).toMatchObject({ title: "الفصل 7 — وردة القمر" });
    // the site's own room still got its usual ping
    expect(bodyOf(posts.find((p) => String(p[0]) === HOOK)!).content).toBe(`<@&${CHAPTER_ROLE}>`);
  });

  it("pings the team's own role on the team's own server — never the site's role", async () => {
    const teamRole = "1200000000000000001";
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK }, { teamChapterWebhook: TEAM_HOOK, teamRoleId: teamRole });
    await publishAndWait(service, "s1", 7);
    const teamBody = bodyOf(calls("discord.com").find((p) => String(p[0]) === TEAM_HOOK)!);
    expect(teamBody.content).toBe(`<@&${teamRole}>`);
    expect(teamBody.allowed_mentions).toEqual({ parse: [], roles: [teamRole] });
    // the site's room is unaffected — still its own role, never the team's
    expect(bodyOf(calls("discord.com").find((p) => String(p[0]) === HOOK)!).content).toBe(`<@&${CHAPTER_ROLE}>`);
  });

  it("pings no one on the team's server when the saved role id is not a real Discord id", async () => {
    const { service } = build({}, { teamChapterWebhook: TEAM_HOOK, teamRoleId: "not-a-role" });
    await publishAndWait(service, "s1", 7);
    const teamBody = bodyOf(calls("discord.com")[0]);
    expect(teamBody.content).toBeUndefined();
    expect(teamBody.allowed_mentions).toEqual({ parse: [] });
  });

  it("never posts a chapter to the team's own new-work webhook — the two are independent", async () => {
    const { service } = build({}, { teamSeriesWebhook: SERIES_HOOK });
    await publishAndWait(service, "s1", 7);
    expect(calls("discord.com")).toHaveLength(0);
  });

  it("posts to the team's server alone when the site's own chapters room is not configured", async () => {
    const { service } = build({}, { teamChapterWebhook: TEAM_HOOK });
    await publishAndWait(service, "s1", 7);
    expect(calls("discord.com")).toHaveLength(1);
    expect(String(calls("discord.com")[0][0])).toBe(TEAM_HOOK);
  });

  it("never sends to a team's saved address that is not really a Discord webhook", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK }, { teamChapterWebhook: "https://evil.example/steal" });
    await publishAndWait(service, "s1", 7);
    expect(calls("discord.com")).toHaveLength(1);
    expect(calls("evil.example")).toHaveLength(0);
  });

  it("does not fail the whole announcement when the team's own server is down", async () => {
    fetchMock.mockImplementation(async (url) => new Response("{}", { status: String(url).includes("team-server") ? 500 : 200 }));
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK }, { teamChapterWebhook: TEAM_HOOK });
    await expect(publishAndWait(service, "s1", 7)).resolves.toBeUndefined();
    expect(calls("discord.com")).toHaveLength(2);
  });

  it("takes another role from the settings, and pings nobody when the setting is not a role id", async () => {
    const other = build({ DISCORD_WEBHOOK_URL: HOOK, DISCORD_CHAPTER_ROLE_ID: "999999999999999999" });
    await publishAndWait(other.service, "s1", 7);
    expect(bodyOf(calls("discord.com")[0]).content).toBe("<@&999999999999999999>");

    fetchMock.mockClear();
    const broken = build({ DISCORD_WEBHOOK_URL: HOOK, DISCORD_CHAPTER_ROLE_ID: "everyone" });
    await publishAndWait(broken.service, "s1", 7);
    const body = bodyOf(calls("discord.com")[0]);
    expect(body.content).toBeUndefined();
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it("ignores a webhook address that is not Discord's", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: "https://evil.example/hook" });
    await publishAndWait(service, "s1", 7);
    expect(calls("evil.example")).toHaveLength(0);
  });

  it("posts the cover to Telegram in the channel's style: a tag, the title, quote blocks (the story expandable), the link, the team", async () => {
    const { service } = build(TELEGRAM);
    await publishAndWait(service, "s1", 7);
    const [photo] = calls("/sendPhoto");
    expect(String(photo[0])).toBe("https://api.telegram.org/bot123:token/sendPhoto");
    expect(bodyOf(photo)).toMatchObject({ chat_id: "@lunex", parse_mode: "HTML" });
    const caption: string = bodyOf(photo).caption;
    expect(caption.startsWith("#فصل_جديد\n\n<b>وردة القمر</b>")).toBe(true);
    expect(caption).toContain("<blockquote>الفصل: الفصل 7\nالتصنيف: خيالي، دراما</blockquote>");
    expect(caption).toContain("<blockquote expandable>القصة: قصة طويلة عن وردة</blockquote>");
    expect(caption).toContain("الفريق: Nova &amp; Co");
    // the closing wish is the link to the chapter
    expect(caption.endsWith('<a href="https://lunexteam.com/series/moon-rose/7">مشاهدة ممتعة</a>')).toBe(true);
    expect(caption).not.toContain("اقرأ الآن");
    expect(calls("/sendMessage")).toHaveLength(0);
  });

  it("cuts a long story so the caption fits Telegram's limit, and leaves out the genres line when there are none", async () => {
    const { service } = build(TELEGRAM, { synopsis: "كلمة ".repeat(600), genres: [] });
    await publishAndWait(service, "s1", 7);
    const caption: string = bodyOf(calls("/sendPhoto")[0]).caption;
    const text = caption.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
    expect(text.length).toBeLessThanOrEqual(1024);
    expect(caption).toContain("…</blockquote>");
    expect(caption).not.toContain("التصنيف");
  });

  it("falls back to a message when the photo is refused, and to plain text when the quote blocks are refused too", async () => {
    fetchMock.mockImplementation(async (url) => new Response("{}", { status: String(url).includes("sendPhoto") ? 400 : 200 }));
    await publishAndWait(build(TELEGRAM).service, "s1", 8);
    expect(calls("/sendMessage")).toHaveLength(1);
    expect(bodyOf(calls("/sendMessage")[0]).parse_mode).toBe("HTML");

    fetchMock.mockClear();
    fetchMock.mockImplementation(async (url, init) => {
      const refused = String(url).includes("sendPhoto") || (typeof (init as RequestInit)?.body === "string" && JSON.parse((init as RequestInit).body as string).parse_mode === "HTML");
      return new Response("{}", { status: refused ? 400 : 200 });
    });
    await publishAndWait(build(TELEGRAM).service, "s1", 9);
    const messages = calls("/sendMessage");
    expect(messages).toHaveLength(2);
    expect(bodyOf(messages[1]).parse_mode).toBeUndefined();
    expect(bodyOf(messages[1]).text).toContain("https://lunexteam.com/series/moon-rose/9");
  });

  it("puts a batch of chapters of one work into one announcement", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK });
    await publishAndWait(service, "s1", 12, 10, 11);
    const posts = calls("discord.com");
    expect(posts).toHaveLength(1);
    expect(bodyOf(posts[0]).embeds[0]).toMatchObject({ title: "الفصول 10–12 — وردة القمر", url: "https://lunexteam.com/series/moon-rose" });
  });

  it("says nothing about a chapter taken down in the meantime, or a work that is not listed", async () => {
    const down = build({ DISCORD_WEBHOOK_URL: HOOK }, { published: [] });
    await publishAndWait(down.service, "s1", 7);
    expect(fetchMock).not.toHaveBeenCalled();
    const hidden = build({ DISCORD_WEBHOOK_URL: HOOK }, { state: "pending" });
    await publishAndWait(hidden.service, "s1", 7);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when a channel is down", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK, ...TELEGRAM });
    await expect(publishAndWait(service, "s1", 7)).resolves.toBeUndefined();
  });

  it("does not ping search engines from a developer's machine", async () => {
    const { service } = build({ FRONTEND_URL: "http://localhost:3000" });
    await publishAndWait(service, "s1", 7);
    expect(calls("indexnow")).toHaveLength(0);
  });
});

/** Adds a work and lets the batching window pass and the queue run. */
async function addAndWait(service: AnnouncementsService, seriesId: string) {
  service.seriesAdded(seriesId);
  const done = service.flushSeries(seriesId);
  await jest.advanceTimersByTimeAsync(5_000);
  await done;
}

describe("announcing a new work", () => {
  it("posts to the works room, not the chapters room: the work, its story, genres, team, a big cover — pinging the works role", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK, DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK });
    await addAndWait(service, "s1");
    const posts = calls("discord.com");
    expect(posts).toHaveLength(1);
    expect(String(posts[0][0])).toBe(SERIES_HOOK);
    const body = bodyOf(posts[0]);
    expect(body.content).toBe(`<@&${SERIES_ROLE}>`);
    expect(body.allowed_mentions).toEqual({ parse: [], roles: [SERIES_ROLE] });
    expect(body.embeds[0]).toMatchObject({
      title: "عمل جديد — وردة القمر",
      url: "https://lunexteam.com/series/moon-rose",
      description: "قصة طويلة عن وردة",
      image: { url: `https://lunexteam.com/api/catalog/series/s1/cover?v=${new Date("2026-09-20T00:00:00Z").getTime()}` },
      fields: [
        { name: "التصنيف", value: "خيالي، دراما", inline: false },
        { name: "الفريق", value: "Nova & Co", inline: true },
      ],
    });
  });

  it("also posts a new work to the team's own server, unpinged, alongside the site's works room", async () => {
    const { service } = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK }, { teamSeriesWebhook: TEAM_HOOK });
    await addAndWait(service, "s1");
    const posts = calls("discord.com");
    expect(posts.map((p) => String(p[0])).sort()).toEqual([SERIES_HOOK, TEAM_HOOK].sort());
    const teamBody = bodyOf(posts.find((p) => String(p[0]) === TEAM_HOOK)!);
    expect(teamBody.content).toBeUndefined();
    expect(teamBody.embeds[0]).toMatchObject({ title: "عمل جديد — وردة القمر" });
  });

  it("pings the team's own role for a new work too, when it set one", async () => {
    const teamRole = "1200000000000000002";
    const { service } = build({}, { teamSeriesWebhook: TEAM_HOOK, teamRoleId: teamRole });
    await addAndWait(service, "s1");
    const teamBody = bodyOf(calls("discord.com")[0]);
    expect(teamBody.content).toBe(`<@&${teamRole}>`);
  });

  it("never posts a new work to the team's own chapters webhook — the two are independent", async () => {
    const { service } = build({}, { teamChapterWebhook: HOOK });
    await addAndWait(service, "s1");
    expect(calls("discord.com")).toHaveLength(0);
  });

  it("posts to both of a team's webhooks separately when both are set — a chapter to one, a new work to the other", async () => {
    const chapters = build({}, { teamChapterWebhook: HOOK, teamSeriesWebhook: TEAM_HOOK });
    await addAndWait(chapters.service, "s1");
    expect(calls("discord.com").map((c) => String(c[0]))).toEqual([TEAM_HOOK]);
    fetchMock.mockClear();
    await publishAndWait(chapters.service, "s1", 7);
    expect(calls("discord.com").map((c) => String(c[0]))).toEqual([HOOK]);
  });

  it("does nothing on Discord without the works room's setting (the chapters room is never used for it), but still tells the search engines", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK });
    await addAndWait(service, "s1");
    expect(calls("discord.com")).toHaveLength(0);
    expect(bodyOf(calls("indexnow")[0])).toMatchObject({ urlList: ["https://lunexteam.com/series/moon-rose"] });
  });

  it("announces a work once, however many times it is reported, and says nothing of a work that is not listed", async () => {
    const { service } = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK });
    service.seriesAdded("s1");
    service.seriesAdded("s1");
    const done = service.flushSeries("s1");
    await jest.advanceTimersByTimeAsync(5_000);
    await done;
    expect(calls("discord.com")).toHaveLength(1);

    fetchMock.mockClear();
    const hidden = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK }, { state: "pending" });
    await addAndWait(hidden.service, "s1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits ten minutes by itself, and never posts anything to Telegram", async () => {
    const { service } = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK, ...TELEGRAM });
    service.seriesAdded("s1");
    await jest.advanceTimersByTimeAsync(9 * 60_000 + 59_000);
    expect(fetchMock).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(calls("discord.com")).toHaveLength(1);
    expect(calls("api.telegram.org")).toHaveLength(0);
  });

  it("never throws when the room is down", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const { service } = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK });
    await expect(addAndWait(service, "s1")).resolves.toBeUndefined();
  });
});

describe("a restart while an announcement waits", () => {
  const flushMicrotasks = () => jest.advanceTimersByTimeAsync(0);

  it("saves what is waiting — a batch of chapters (kept in one row with the first due time) and a new work — and takes it off the list once sent", async () => {
    const { service, store } = build({ DISCORD_WEBHOOK_URL: HOOK, DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK });
    service.chapterPublished("s1", 10);
    service.seriesAdded("s1");
    await flushMicrotasks();
    const first = store.get("chapter:s1")?.dueAt.getTime();
    expect(store.get("chapter:s1")).toMatchObject({ numbers: [10] });
    expect(store.has("series:s1")).toBe(true);

    await jest.advanceTimersByTimeAsync(60_000);
    service.chapterPublished("s1", 11);
    await flushMicrotasks();
    expect(store.get("chapter:s1")).toMatchObject({ numbers: [10, 11] });
    expect(store.get("chapter:s1")?.dueAt.getTime()).toBe(first);

    await jest.advanceTimersByTimeAsync(10 * 60_000 + 5_000);
    expect(store.size).toBe(0);
    expect(calls("discord.com")).toHaveLength(2);
  });

  it("does not lose a chapter announcement to a restart before its time: the new process sends it when its time comes, once", async () => {
    const first = build({ DISCORD_WEBHOOK_URL: HOOK });
    first.service.chapterPublished("s1", 10);
    first.service.chapterPublished("s1", 11);
    await flushMicrotasks();
    await jest.advanceTimersByTimeAsync(4 * 60_000);
    first.service.onModuleDestroy(); // the redeploy: its timers go

    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();

    const second = build({ DISCORD_WEBHOOK_URL: HOOK }, { store: first.store });
    await second.service.onModuleInit();
    await jest.advanceTimersByTimeAsync(4 * 60_000); // 4 + 1 + 4 minutes in: still waiting (due at 10)
    expect(fetchMock).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2 * 60_000);
    const posts = calls("discord.com");
    expect(posts).toHaveLength(1);
    expect(bodyOf(posts[0]).embeds[0]).toMatchObject({ title: "الفصول 10–11 — وردة القمر" });
    expect(first.store.size).toBe(0);
  });

  it("sends at once what was already overdue when the process came back, and a new work only once", async () => {
    const first = build({ DISCORD_WEBHOOK_URL: HOOK, DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK });
    first.service.chapterPublished("s1", 7);
    first.service.seriesAdded("s1");
    await flushMicrotasks();
    first.service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(30 * 60_000); // the backend was down for half an hour

    const second = build({ DISCORD_WEBHOOK_URL: HOOK, DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK }, { store: first.store });
    await second.service.onModuleInit();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(calls("discord.com")).toHaveLength(2); // the chapter and the new work, one each
    await jest.advanceTimersByTimeAsync(20 * 60_000);
    expect(calls("discord.com")).toHaveLength(2);
    expect(first.store.size).toBe(0);
  });

  it("starts even when the saved list cannot be read, and never fails because it could not be saved", async () => {
    const broken = build({ DISCORD_WEBHOOK_URL: HOOK });
    broken.repo.pendingAnnouncements.mockRejectedValue(new Error("db down"));
    await expect(broken.service.onModuleInit()).resolves.toBeUndefined();

    const unsaved = build({ DISCORD_WEBHOOK_URL: HOOK });
    unsaved.repo.savePending.mockRejectedValue(new Error("db down"));
    unsaved.repo.clearPending.mockRejectedValue(new Error("db down"));
    await publishAndWait(unsaved.service, "s1", 7); // the announcement itself still goes out
    expect(calls("discord.com")).toHaveLength(1);
  });
});

describe("announcing a new work right now", () => {
  it("sends it at once and takes it off the waiting list, so it is never announced twice", async () => {
    const { service, store } = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK });
    service.seriesAdded("s1");
    await jest.advanceTimersByTimeAsync(0);
    expect(store.has("series:s1")).toBe(true);

    const sending = service.announceSeriesNow("s1");
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(sending).resolves.toBe("sent");
    expect(calls("discord.com")).toHaveLength(1);
    expect(store.size).toBe(0);

    await jest.advanceTimersByTimeAsync(11 * 60_000);
    expect(calls("discord.com")).toHaveLength(1);
  });

  it("refuses a work that is not listed yet, or does not exist, and posts nothing", async () => {
    const hidden = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK }, { state: "pending" });
    await expect(hidden.service.announceSeriesNow("s1")).resolves.toBe("not_listed");
    const missing = build({ DISCORD_NEW_SERIES_WEBHOOK_URL: SERIES_HOOK });
    missing.repo.findSeries.mockResolvedValueOnce(null as never);
    await expect(missing.service.announceSeriesNow("nope")).resolves.toBe("not_found");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

