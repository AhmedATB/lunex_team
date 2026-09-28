import type { ConfigService } from "@nestjs/config";
import * as webpush from "web-push";
import { PushService } from "./push.service";
import type { PushRepository } from "./push.repository";

jest.mock("web-push", () => ({
  generateVAPIDKeys: jest.fn(() => ({ publicKey: "made-public", privateKey: "made-private" })),
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));
const send = webpush.sendNotification as unknown as jest.Mock;

const sub = (id: string, userId: string) => ({ id, userId, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: "k", auth: "a" });

function build(options: { settings?: Record<string, string>; env?: Record<string, string>; subs?: ReturnType<typeof sub>[]; prefs?: Record<string, Record<string, boolean>> } = {}) {
  const settings = { ...(options.settings ?? {}) };
  const subs = options.subs ?? [];
  const repo = {
    getSetting: jest.fn(async (key: string) => settings[key] ?? null),
    setSettingIfMissing: jest.fn(async (key: string, value: string) => {
      if (!(key in settings)) settings[key] = value;
    }),
    upsertSubscription: jest.fn().mockResolvedValue({ id: "s1" }),
    deleteSubscription: jest.fn().mockResolvedValue({ count: 1 }),
    deleteSubscriptionById: jest.fn().mockResolvedValue({ count: 1 }),
    countSubscriptions: jest.fn().mockResolvedValue(2),
    hasSubscription: jest.fn().mockResolvedValue(true),
    subscriptionsFor: jest.fn(async (ids: string[]) => subs.filter((s) => ids.includes(s.userId))),
    subscriptionsPage: jest.fn(async (after: string | null) => (after ? [] : subs)),
    preferencesFor: jest.fn(async (ids: string[]) => new Map(ids.filter((id) => options.prefs?.[id]).map((id) => [id, { chapters: true, messages: true, replies: true, news: true, account: true, ...options.prefs![id] }]))),
    getPreferences: jest.fn().mockResolvedValue({ chapters: true, messages: true, replies: true, news: true, account: true }),
    savePreferences: jest.fn(async (_id: string, p: Record<string, boolean>) => ({ chapters: true, messages: true, replies: true, news: true, account: true, ...p })),
    libraryReaderIds: jest.fn().mockResolvedValue(["u1", "u2"]),
    chatContext: jest.fn().mockResolvedValue({ isGroup: false, title: null, recipientIds: ["u2"], senderName: "سارة" }),
  };
  const config = { get: (key: string) => options.env?.[key] } as unknown as ConfigService;
  return { service: new PushService(repo as unknown as PushRepository, config), repo, settings };
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ statusCode: 201 });
  (webpush.setVapidDetails as jest.Mock).mockClear();
  (webpush.generateVAPIDKeys as jest.Mock).mockClear();
});

const sent = () => send.mock.calls.map((c) => ({ endpoint: (c[0] as { endpoint: string }).endpoint, body: JSON.parse(c[1] as string) as Record<string, unknown> }));

describe("the site's keys", () => {
  it("makes them once and keeps them, so they survive a restart", async () => {
    const first = build();
    expect(await first.service.publicKey()).toEqual({ publicKey: "made-public" });
    expect(first.settings).toMatchObject({ vapid_public_key: "made-public", vapid_private_key: "made-private" });
    const second = build({ settings: first.settings });
    expect(await second.service.publicKey()).toEqual({ publicKey: "made-public" });
    expect(webpush.generateVAPIDKeys).toHaveBeenCalledTimes(1);
  });

  it("identifies the site by an https or mailto contact, never a local http address", async () => {
    const local = build({ env: { FRONTEND_URL: "http://localhost:3737" } });
    await local.service.publicKey();
    expect(webpush.setVapidDetails).toHaveBeenLastCalledWith("https://lunexteam.com", "made-public", "made-private");
    const live = build({ env: { FRONTEND_URL: "https://lunexteam.com" } });
    await live.service.publicKey();
    expect(webpush.setVapidDetails).toHaveBeenLastCalledWith("https://lunexteam.com", "made-public", "made-private");
  });

  it("takes them from the environment when they are set there", async () => {
    const { service, repo } = build({ env: { VAPID_PUBLIC_KEY: "env-public", VAPID_PRIVATE_KEY: "env-private", VAPID_SUBJECT: "mailto:team@lunexteam.com" } });
    expect(await service.publicKey()).toEqual({ publicKey: "env-public" });
    expect(webpush.setVapidDetails).toHaveBeenCalledWith("mailto:team@lunexteam.com", "env-public", "env-private");
    expect(repo.setSettingIfMissing).not.toHaveBeenCalled();
  });
});

describe("subscribing a device", () => {
  it("keeps the device's address and keys against the account", async () => {
    const { service, repo } = build();
    await service.subscribe("u1", { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "k", auth: "a" } }, "Chrome");
    expect(repo.upsertSubscription).toHaveBeenCalledWith({ userId: "u1", endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "k", auth: "a", userAgent: "Chrome" });
  });

  it("accepts the browsers' own push services, and refuses any other address (the site would send to it)", async () => {
    const { service, repo } = build();
    const keys = { p256dh: "k", auth: "a" };
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/x",
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/x",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ]) {
      await expect(service.subscribe("u1", { endpoint, keys }, undefined)).resolves.toEqual({ subscribed: true });
    }
    repo.upsertSubscription.mockClear();
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://evil.example/fcm.googleapis.com/",
      "https://fcm.googleapis.com.evil.example/x",
      "https://127.0.0.1:4000/v1/auth/refresh",
      "https://169.254.169.254/latest/meta-data",
      "file:///etc/passwd",
    ]) {
      await expect(service.subscribe("u1", { endpoint, keys }, undefined)).rejects.toMatchObject({ response: { code: "invalid_endpoint" } });
    }
    expect(repo.upsertSubscription).not.toHaveBeenCalled();
  });

  it("removes a device only from the account that asks", async () => {
    const { service, repo } = build();
    await service.unsubscribe("u1", "https://fcm.googleapis.com/fcm/send/abc");
    expect(repo.deleteSubscription).toHaveBeenCalledWith("u1", "https://fcm.googleapis.com/fcm/send/abc");
  });

  it("reports the state and saves only the switches given", async () => {
    const { service, repo } = build();
    expect(await service.status("u1", "https://fcm.googleapis.com/fcm/send/abc")).toMatchObject({ devices: 2, thisDevice: true });
    expect((await service.setPreferences("u1", { messages: false })).messages).toBe(false);
    expect(repo.savePreferences).toHaveBeenCalledWith("u1", { messages: false });
  });
});

describe("sending", () => {
  it("sends an encrypted notification to each device of the account, with the words, the link and the tag", async () => {
    const { service } = build({ subs: [sub("d1", "u1"), sub("d2", "u1"), sub("d3", "u2")] });
    await service.toUser("u1", "chapters", { title: "فصل جديد من X", body: "صدر الفصل 5", url: "/series/x/5", tag: "chapter-x" });
    expect(sent().map((s) => s.endpoint)).toEqual(["https://fcm.googleapis.com/fcm/send/d1", "https://fcm.googleapis.com/fcm/send/d2"]);
    expect(sent()[0].body).toEqual({ title: "فصل جديد من X", body: "صدر الفصل 5", url: "/series/x/5", tag: "chapter-x" });
    expect(send.mock.calls[0][2]).toMatchObject({ TTL: 86_400 });
  });

  it("skips an account that turned that kind off, but not the others", async () => {
    const { service } = build({ subs: [sub("d1", "u1"), sub("d2", "u2")], prefs: { u1: { messages: false } } });
    await service.toUsers(["u1", "u2"], "messages", { title: "t" });
    expect(sent().map((s) => s.endpoint)).toEqual(["https://fcm.googleapis.com/fcm/send/d2"]);
    send.mockClear();
    await service.toUsers(["u1"], "chapters", { title: "t" });
    expect(sent()).toHaveLength(1);
  });

  it("drops a device the push service says is gone, and keeps one that merely failed", async () => {
    const { service, repo } = build({ subs: [sub("gone", "u1"), sub("busy", "u1"), sub("fine", "u1")] });
    send.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (s.endpoint.endsWith("busy")) throw Object.assign(new Error("busy"), { statusCode: 503 });
      return { statusCode: 201 };
    });
    await service.toUser("u1", "account", { title: "t" });
    expect(repo.deleteSubscriptionById).toHaveBeenCalledTimes(1);
    expect(repo.deleteSubscriptionById).toHaveBeenCalledWith("gone");
  });

  it("never throws, whatever goes wrong", async () => {
    const { service, repo } = build({ subs: [sub("d1", "u1")] });
    repo.subscriptionsFor.mockRejectedValue(new Error("database down"));
    await expect(service.toUser("u1", "account", { title: "t" })).resolves.toBeUndefined();
    await expect(service.toLibraryReaders("s1", { title: "t" })).resolves.toBeUndefined();
    repo.subscriptionsPage.mockRejectedValue(new Error("database down"));
    await expect(service.toEveryone("news", { title: "t" })).resolves.toBeUndefined();
  });

  it("cuts a long title and text so the notification stays small", async () => {
    const { service } = build({ subs: [sub("d1", "u1")] });
    await service.toUser("u1", "account", { title: "ع".repeat(300), body: "ن".repeat(900) });
    const body = sent()[0].body as { title: string; body: string };
    expect(body.title.length).toBeLessThanOrEqual(80);
    expect(body.body.length).toBeLessThanOrEqual(160);
  });

  it("tells the library readers of a work about a new chapter", async () => {
    const { service, repo } = build({ subs: [sub("d1", "u1"), sub("d2", "u2"), sub("d3", "u3")] });
    await service.toLibraryReaders("s1", { title: "t", url: "/series/x/5" });
    expect(repo.libraryReaderIds).toHaveBeenCalledWith("s1");
    expect(sent().map((s) => s.endpoint)).toEqual(["https://fcm.googleapis.com/fcm/send/d1", "https://fcm.googleapis.com/fcm/send/d2"]);
  });

  it("tells every device of an account that wants it about news", async () => {
    const { service } = build({ subs: [sub("d1", "u1"), sub("d2", "u2")], prefs: { u2: { news: false } } });
    await service.toEveryone("news", { title: "خبر" });
    expect(sent().map((s) => s.endpoint)).toEqual(["https://fcm.googleapis.com/fcm/send/d1"]);
  });
});

describe("messages", () => {
  it("shows the sender's name and words for a chat between two, linking to that chat", async () => {
    const { service } = build({ subs: [sub("d1", "u2")] });
    await service.newMessage("c1", "u1", "  مرحبا  ", 0);
    expect(sent()[0].body).toMatchObject({ title: "سارة", body: "مرحبا", url: "/messages?chat=c1", tag: "chat-c1" });
  });

  it("shows the group name and the sender with the words for a group, and a picture as a picture", async () => {
    const { service, repo } = build({ subs: [sub("d1", "u2")] });
    repo.chatContext.mockResolvedValue({ isGroup: true, title: "فريق الترجمة", recipientIds: ["u2"], senderName: "سارة" });
    await service.newMessage("c1", "u1", "", 1);
    expect(sent()[0].body).toMatchObject({ title: "فريق الترجمة", body: "سارة: 📷 صورة" });
    send.mockClear();
    await service.newMessage("c1", "u1", "", 3);
    expect(sent()[0].body).toMatchObject({ body: "سارة: 📷 3 صور" });
  });

  it("tells no one when the chat has no one else, and honours the switch", async () => {
    const empty = build({ subs: [sub("d1", "u2")] });
    empty.repo.chatContext.mockResolvedValue({ isGroup: false, title: null, recipientIds: [], senderName: "سارة" });
    await empty.service.newMessage("c1", "u1", "hi", 0);
    expect(send).not.toHaveBeenCalled();
    const off = build({ subs: [sub("d1", "u2")], prefs: { u2: { messages: false } } });
    await off.service.newMessage("c1", "u1", "hi", 0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("a test notification", () => {
  it("reaches the account's devices, and says plainly when there are none", async () => {
    const { service } = build({ subs: [sub("d1", "u1")] });
    expect(await service.sendTest("u1")).toEqual({ sent: 1 });
    await expect(service.sendTest("nobody")).rejects.toMatchObject({ response: { code: "no_devices" } });
  });
});
