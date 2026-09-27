import type { ConfigService } from "@nestjs/config";
import type { AnnouncementsRepository } from "./announcements.repository";
import { AnnouncementsService } from "./announcements.service";

const HOOK = "https://discord.com/api/webhooks/123/abc";
const TELEGRAM = { TELEGRAM_BOT_TOKEN: "123:token", TELEGRAM_CHAT_ID: "@lunex" };

function build(settings: Record<string, string> = {}, options: { published?: number[]; state?: string; synopsis?: string; genres?: string[] } = {}) {
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
  };
  const config = { get: (key: string) => ({ FRONTEND_URL: "https://lunexteam.com/", ...settings })[key] } as unknown as ConfigService;
  return { service: new AnnouncementsService(repo as unknown as AnnouncementsRepository, config), repo };
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

/** Publishes, lets the minute pass and the queue run. */
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

  it("posts an embed to the Discord channel: the chapter, the work, its cover, the team — and mentions nobody", async () => {
    const { service } = build({ DISCORD_WEBHOOK_URL: HOOK });
    await publishAndWait(service, "s1", 7);
    const [post] = calls("discord.com");
    expect(String(post[0])).toBe(HOOK);
    const body = bodyOf(post);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds[0]).toMatchObject({
      title: "الفصل 7 — وردة القمر",
      url: "https://lunexteam.com/series/moon-rose/7",
      description: "قصة طويلة عن وردة",
      thumbnail: { url: `https://lunexteam.com/api/catalog/series/s1/cover?v=${new Date("2026-09-20T00:00:00Z").getTime()}` },
      footer: { text: "الفريق: Nova & Co" },
    });
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
