import { chapterBody, coinsBody } from "./notification-text";
import type { PushService } from "../push/push.service";
import type { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

describe("notification wording", () => {
  it("says how many chapters came out, with Arabic number agreement", () => {
    expect(chapterBody(1, "14")).toBe("صدر الفصل 14");
    expect(chapterBody(2, "14")).toBe("صدر فصلان جديدان — آخرها الفصل 14");
    expect(chapterBody(4, "14")).toBe("صدرت 4 فصول جديدة — آخرها الفصل 14");
    expect(chapterBody(12, "14")).toBe("صدر 12 فصلًا جديدًا — آخرها الفصل 14");
  });

  it("words a coin transfer, with the owner's note when there is one", () => {
    expect(coinsBody(1)).toBe("تم تحويل عملة واحدة إلى حسابك.");
    expect(coinsBody(2)).toBe("تم تحويل عملتين إلى حسابك.");
    expect(coinsBody(150)).toBe("تم تحويل 150 عملة إلى حسابك.");
    expect(coinsBody(150, " دفعة ديسكورد ")).toBe("تم تحويل 150 عملة إلى حسابك. (دفعة ديسكورد)");
  });
});

const item = (overrides: Record<string, unknown> = {}) => ({ id: "n", userId: "u1", type: "chapter", title: "t", body: null, link: null, refId: null, count: 1, read: false, createdAt: new Date(), ...overrides });

function build(overrides: Record<string, unknown> = {}) {
  const repo = {
    create: jest.fn().mockResolvedValue({ id: "n1" }),
    listForUser: jest.fn().mockResolvedValue([item({ id: "a" }), item({ id: "b" }), item({ id: "c" })]),
    countUnread: jest.fn().mockResolvedValue(7),
    markRead: jest.fn().mockResolvedValue(undefined),
    markAllRead: jest.fn().mockResolvedValue(undefined),
    broadcast: jest.fn().mockResolvedValue(undefined),
    notifyChapter: jest.fn().mockResolvedValue(undefined),
    findSeriesLabel: jest.fn().mockResolvedValue({ slug: "shadow-slave", titleAr: "عبد الظل", titleEn: "Shadow Slave", synopsis: "  قصة طويلة  " }),
    latestChapterThumbnail: jest.fn().mockResolvedValue(null),
    findNewsLabel: jest.fn().mockResolvedValue({ title: "تحديث", excerpt: "ملخص", isPublished: true }),
    ...overrides,
  };
  const push = {
    toUser: jest.fn().mockResolvedValue(undefined),
    toEveryone: jest.fn().mockResolvedValue(undefined),
    toLibraryReaders: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new NotificationsService(repo as unknown as NotificationsRepository, push as unknown as PushService), repo, push };
}

describe("NotificationsService.list", () => {
  it("returns one page, says whether there is more, and passes the category and cursor on", async () => {
    const { service, repo } = build();
    const before = "2026-09-20T00:00:00.000Z";
    const page = await service.list("u1", { category: "news", limit: 2, before });
    expect(page.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(page.hasMore).toBe(true);
    expect(page.unreadCount).toBe(7);
    expect(repo.listForUser).toHaveBeenCalledWith("u1", { category: "news", limit: 3, before: new Date(before) });
  });

  it("clamps the page size and ignores a cursor that is not a date", async () => {
    const { service, repo } = build();
    await service.list("u1", { limit: 9999, before: "nonsense" });
    expect(repo.listForUser).toHaveBeenCalledWith("u1", { category: undefined, limit: 101, before: undefined });
  });
});

describe("content notifications", () => {
  it("tells followers of a series about a new chapter, linking to that chapter", async () => {
    const { service, repo } = build();
    await service.chapterPublished("s1", 14);
    expect(repo.notifyChapter).toHaveBeenCalledWith({
      seriesId: "s1",
      title: "فصل جديد من عبد الظل",
      link: "/series/shadow-slave/14",
      latest: "14",
      firstBody: "صدر الفصل 14",
    });
  });

  it("announces a new series to everyone, with a short synopsis", async () => {
    const { service, repo } = build();
    await service.seriesAdded("s1");
    expect(repo.broadcast).toHaveBeenCalledWith({ type: "series", title: "سلسلة جديدة: عبد الظل", body: "قصة طويلة", link: "/series/shadow-slave", refId: "s1" });
  });

  it("announces a published news post, never a draft", async () => {
    const { service, repo } = build();
    await service.newsPublished("n1");
    expect(repo.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "news", title: "خبر جديد: تحديث", link: "/news?post=n1", refId: "n1" }));
    repo.broadcast.mockClear();
    repo.findNewsLabel.mockResolvedValue({ title: "مسودة", excerpt: "", isPublished: false });
    await service.newsPublished("n2");
    expect(repo.broadcast).not.toHaveBeenCalled();
  });

  it("tells a member about coins that were added", async () => {
    const { service, repo } = build();
    await service.coinsGranted("u1", 150, "دفعة");
    expect(repo.create).toHaveBeenCalledWith({ userId: "u1", type: "coins", title: "وصلتك عملات", body: "تم تحويل 150 عملة إلى حسابك. (دفعة)", link: "/store" });
  });

  it("never lets a failing notification break the action that caused it", async () => {
    const { service } = build({ notifyChapter: jest.fn().mockRejectedValue(new Error("db down")), broadcast: jest.fn().mockRejectedValue(new Error("db down")), create: jest.fn().mockRejectedValue(new Error("db down")) });
    await expect(service.chapterPublished("s1", 1)).resolves.toBeUndefined();
    await expect(service.seriesAdded("s1")).resolves.toBeUndefined();
    await expect(service.coinsGranted("u1", 5)).resolves.toBeUndefined();
  });
});

describe("notifications that also reach a phone", () => {
  it("sends a notification to the member's devices as well, under the switch for its kind", async () => {
    const { service, push } = build();
    await service.notify("u1", "reply", "رد جديد على تعليقك", "سارة: أوافقك", "/series/moon-rose/6");
    expect(push.toUser).toHaveBeenCalledWith("u1", "replies", expect.objectContaining({ title: "رد جديد على تعليقك", url: "/series/moon-rose/6" }));
    await service.notify("u1", "moderation", "تنبيه", "نص");
    expect(push.toUser).toHaveBeenLastCalledWith("u1", "account", expect.any(Object));
    await service.coinsGranted("u1", 50);
    expect(push.toUser).toHaveBeenLastCalledWith("u1", "account", expect.objectContaining({ url: "/store" }));
  });

  it("does not let a failing push undo the notification", async () => {
    const { service, push } = build();
    push.toUser.mockRejectedValue(new Error("push down"));
    await expect(service.notify("u1", "reply", "t", "b")).resolves.toMatchObject({ id: "n1" });
  });

  it("holds a new chapter's push for a minute so a batch is one line, and sends it to the work's library readers", async () => {
    jest.useFakeTimers();
    try {
      const { service, push } = build();
      await service.chapterPublished("s1", 13);
      await service.chapterPublished("s1", 14);
      await service.chapterPublished("s1", 15);
      expect(push.toLibraryReaders).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(61_000);
      expect(push.toLibraryReaders).toHaveBeenCalledTimes(1);
      expect(push.toLibraryReaders).toHaveBeenCalledWith("s1", expect.objectContaining({ body: "صدرت الفصول 13–15", url: "/series/shadow-slave", tag: "chapter-s1" }));
    } finally {
      jest.useRealTimers();
    }
  });

  it("sends the chapter's featured picture with the notification when it has one", async () => {
    const { service, push, repo } = build();
    repo.latestChapterThumbnail.mockResolvedValue({ id: "c14", thumbnailAssetId: "abcdef12-3456" });
    await service.chapterPublished("s1", 14);
    await service.flushChapterPush("s1");
    expect(push.toLibraryReaders).toHaveBeenCalledWith("s1", expect.objectContaining({ image: "/api/catalog/chapters/c14/thumbnail?v=abcdef12" }));
    expect(repo.latestChapterThumbnail).toHaveBeenCalledWith("s1", [14]);
  });

  it("names the chapter and links to it when only one came out", async () => {
    const { service, push } = build();
    await service.chapterPublished("s1", 14);
    await service.flushChapterPush("s1");
    expect(push.toLibraryReaders).toHaveBeenCalledWith("s1", expect.objectContaining({ body: "صدر الفصل 14", url: "/series/shadow-slave/14" }));
  });

  it("tells every subscribed device about a new work and about news", async () => {
    const { service, push } = build();
    await service.seriesAdded("s1");
    expect(push.toEveryone).toHaveBeenCalledWith("news", expect.objectContaining({ url: "/series/shadow-slave" }));
    await service.newsPublished("n1");
    expect(push.toEveryone).toHaveBeenLastCalledWith("news", expect.objectContaining({ url: "/news?post=n1" }));
  });
});
