import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { MessagesRepository } from "./messages.repository";
import { MessagesService } from "./messages.service";

const person = (id: string, username = id) => ({ id, username, displayName: null, avatarMimeType: null, updatedAt: new Date("2026-09-20T00:00:00Z") });

const conversationRow = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  title: null,
  isGroup: false,
  createdById: "me",
  lastMessageAt: new Date("2026-09-25T10:00:00Z"),
  members: [{ userId: "me", user: person("me") }, { userId: "sara", user: person("sara") }],
  messages: [],
  ...overrides,
});

function build(overrides: Record<string, unknown> = {}) {
  const repo = {
    findActor: jest.fn().mockResolvedValue({ id: "me", isBanned: false, bannedUntil: null, mutedUntil: null }),
    findPeople: jest.fn(async ({ usernames = [], ids = [] }: { usernames?: string[]; ids?: string[] }) =>
      [person("sara"), person("omar"), person("me")].filter((p) => usernames.includes(p.username) || ids.includes(p.id))
    ),
    findByPairKey: jest.fn().mockResolvedValue(null),
    createConversation: jest.fn().mockResolvedValue({ id: "c1" }),
    addMembers: jest.fn().mockResolvedValue(undefined),
    membership: jest.fn().mockResolvedValue({ conversationId: "c1", userId: "me" }),
    findConversation: jest.fn().mockResolvedValue(conversationRow()),
    listFor: jest.fn().mockResolvedValue([conversationRow()]),
    unreadByConversation: jest.fn().mockResolvedValue(new Map([["c1", 2]])),
    listMessages: jest.fn().mockResolvedValue([]),
    createMessage: jest.fn(async (d: { conversationId: string; senderId: string; text: string }) => ({ id: "m1", createdAt: new Date(), ...d })),
    markRead: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { service: new MessagesService(repo as unknown as MessagesRepository), repo };
}

describe("starting a chat", () => {
  it("makes one direct chat per pair of people, keyed the same whichever of them starts it", async () => {
    const { service, repo } = build();
    await service.create("me", { usernames: ["@sara"] });
    expect(repo.createConversation).toHaveBeenCalledWith({ title: null, isGroup: false, pairKey: "me:sara", createdById: "me", memberIds: ["me", "sara"] });
  });

  it("opens the chat that already exists instead of making a second one", async () => {
    const { service, repo } = build({ findByPairKey: jest.fn().mockResolvedValue({ id: "c1" }) });
    await service.create("me", { userIds: ["sara"] });
    expect(repo.createConversation).not.toHaveBeenCalled();
    expect(repo.addMembers).toHaveBeenCalledWith("c1", ["me", "sara"]);
  });

  it("makes a group of the chosen people, with the given title", async () => {
    const { service, repo } = build();
    await service.create("me", { usernames: ["sara", "omar", "sara"], title: "  فريق الترجمة " });
    expect(repo.createConversation).toHaveBeenCalledWith({ title: "فريق الترجمة", isGroup: true, pairKey: null, createdById: "me", memberIds: ["me", "sara", "omar"] });
  });

  it("refuses a name nobody has, a chat with only yourself, and too many people", async () => {
    const { service } = build();
    await expect(service.create("me", { usernames: ["ghost"] })).rejects.toMatchObject({ response: { code: "user_not_found" } });
    await expect(service.create("me", { usernames: ["me"] })).rejects.toMatchObject({ response: { code: "no_recipients" } });
    const crowd = Array.from({ length: 21 }, (_, i) => person(`u${i}`));
    const big = build({ findPeople: jest.fn().mockResolvedValue(crowd) });
    await expect(big.service.create("me", { userIds: crowd.map((p) => p.id) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a banned account", async () => {
    const { service } = build({ findActor: jest.fn().mockResolvedValue({ id: "me", isBanned: true, bannedUntil: null, mutedUntil: null }) });
    await expect(service.create("me", { usernames: ["sara"] })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("reading and writing", () => {
  it("lists a member's chats with the unread count and the newest message", async () => {
    const { service } = build({ listFor: jest.fn().mockResolvedValue([conversationRow({ messages: [{ id: "m9", senderId: "sara", text: "مرحبًا", createdAt: new Date() }] })]) });
    const { conversations } = await service.list("me");
    expect(conversations[0]).toMatchObject({ id: "c1", unreadCount: 2, isGroup: false, lastMessage: { id: "m9", text: "مرحبًا" } });
    expect(conversations[0].members.map((m) => m.username)).toEqual(["me", "sara"]);
  });

  it("gives the total unread number for the header", async () => {
    const { service } = build({ unreadByConversation: jest.fn().mockResolvedValue(new Map([["a", 2], ["b", 5]])) });
    await expect(service.unreadCount("me")).resolves.toEqual({ unreadConversations: 2, unreadMessages: 7 });
  });

  it("pages a conversation oldest-first and says whether there is more", async () => {
    const rows = [3, 2, 1].map((n) => ({ id: `m${n}`, senderId: "sara", text: `t${n}`, createdAt: new Date(2026, 8, n) }));
    const { service, repo } = build({ listMessages: jest.fn().mockResolvedValue(rows) });
    const page = await service.messages("me", "c1", { limit: 2 });
    expect(page.items.map((m) => m.id)).toEqual(["m2", "m3"]);
    expect(page.hasMore).toBe(true);
    expect(repo.listMessages).toHaveBeenCalledWith("c1", { before: undefined, take: 3 });
  });

  it("keeps a conversation to its members: anyone else is told it does not exist", async () => {
    const { service, repo } = build({ membership: jest.fn().mockResolvedValue(null) });
    await expect(service.messages("me", "c1", {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.send("me", "c1", { text: "hi" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.markRead("me", "c1")).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it("sends a trimmed message, and refuses an empty one or one from a muted account", async () => {
    const { service, repo } = build();
    await expect(service.send("me", "c1", { text: "  مرحبًا  " })).resolves.toMatchObject({ senderId: "me", text: "مرحبًا" });
    expect(repo.createMessage).toHaveBeenCalledWith({ conversationId: "c1", senderId: "me", text: "مرحبًا" });
    await expect(service.send("me", "c1", { text: "   " })).rejects.toMatchObject({ response: { code: "empty_message" } });
    const muted = build({ findActor: jest.fn().mockResolvedValue({ id: "me", isBanned: false, bannedUntil: null, mutedUntil: new Date(Date.now() + 3_600_000) }) });
    await expect(muted.service.send("me", "c1", { text: "hi" })).rejects.toMatchObject({ response: { code: "muted" } });
  });

  it("lets only the person who started a group add people to it", async () => {
    const group = conversationRow({ isGroup: true, createdById: "someone-else" });
    const { service } = build({ findConversation: jest.fn().mockResolvedValue(group) });
    await expect(service.addMembers("me", "c1", { usernames: ["omar"] })).rejects.toBeInstanceOf(ForbiddenException);
    const direct = build();
    await expect(direct.service.addMembers("me", "c1", { usernames: ["omar"] })).rejects.toMatchObject({ response: { code: "not_a_group" } });
    const mine = build({ findConversation: jest.fn().mockResolvedValue(conversationRow({ isGroup: true, createdById: "me" })) });
    await mine.service.addMembers("me", "c1", { usernames: ["omar"] });
    expect(mine.repo.addMembers).toHaveBeenCalledWith("c1", ["omar"]);
  });
});
