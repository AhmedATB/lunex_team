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
    blockedAmong: jest.fn().mockResolvedValue([]),
    directPeer: jest.fn().mockResolvedValue(null),
    findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c1", senderId: "me" }),
    deleteMessage: jest.fn().mockResolvedValue(undefined),
    addBlock: jest.fn().mockResolvedValue(undefined),
    removeBlock: jest.fn().mockResolvedValue(undefined),
    listBlocked: jest.fn().mockResolvedValue([{ createdAt: new Date("2026-09-26T00:00:00Z"), blocked: person("sara") }]),
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

describe("blocking", () => {
  const refused = { response: { code: "cannot_message" } };

  it("refuses to start a chat, direct or group, with someone the caller blocked or who blocked them", async () => {
    const { service, repo } = build({ blockedAmong: jest.fn().mockResolvedValue(["sara"]) });
    await expect(service.create("me", { usernames: ["sara"] })).rejects.toMatchObject(refused);
    await expect(service.create("me", { usernames: ["sara", "omar"] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.createConversation).not.toHaveBeenCalled();
    expect(repo.blockedAmong).toHaveBeenCalledWith("me", ["sara"]);
  });

  it("stops writing in a direct chat with a blocked person, and says the same thing whichever way round", async () => {
    const { service, repo } = build({ directPeer: jest.fn().mockResolvedValue("sara"), blockedAmong: jest.fn().mockResolvedValue(["sara"]) });
    await expect(service.send("me", "c1", { text: "مرحبا" })).rejects.toMatchObject(refused);
    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it("does not check a group (whose people the writer may not be able to leave), and sends where nobody is blocked", async () => {
    const { service, repo } = build(); // directPeer is null: a group
    await service.send("me", "c1", { text: "مرحبا" });
    expect(repo.createMessage).toHaveBeenCalled();
    const direct = build({ directPeer: jest.fn().mockResolvedValue("sara") });
    await direct.service.send("me", "c1", { text: "مرحبا" });
    expect(direct.repo.createMessage).toHaveBeenCalled();
  });

  it("does not add a blocked person to a group", async () => {
    const group = conversationRow({ isGroup: true, members: [{ userId: "me", user: person("me") }] });
    const { service, repo } = build({ findConversation: jest.fn().mockResolvedValue(group), blockedAmong: jest.fn().mockResolvedValue(["omar"]) });
    await expect(service.addMembers("me", "c1", { usernames: ["omar"] })).rejects.toMatchObject(refused);
    expect(repo.addMembers).not.toHaveBeenCalled();
  });

  it("blocks, unblocks and lists — never oneself, never someone who does not exist", async () => {
    const { service, repo } = build();
    await service.block("me", "sara");
    expect(repo.addBlock).toHaveBeenCalledWith("me", "sara");
    await service.unblock("me", "sara");
    expect(repo.removeBlock).toHaveBeenCalledWith("me", "sara");
    await expect(service.blocked("me")).resolves.toEqual({ items: [expect.objectContaining({ id: "sara", blockedAt: expect.any(Date) })] });
    await expect(service.block("me", "me")).rejects.toMatchObject({ response: { code: "cannot_block_self" } });
    await expect(service.block("me", "ghost")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("deleting a message", () => {
  it("lets the writer take their own message back", async () => {
    const { service, repo } = build();
    await service.deleteMessage("me", "c1", "m1");
    expect(repo.deleteMessage).toHaveBeenCalledWith("m1");
  });

  it("never lets anyone delete another person's message, or one from another conversation", async () => {
    const theirs = build({ findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c1", senderId: "sara" }) });
    await expect(theirs.service.deleteMessage("me", "c1", "m1")).rejects.toBeInstanceOf(ForbiddenException);
    const elsewhere = build({ findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c2", senderId: "me" }) });
    await expect(elsewhere.service.deleteMessage("me", "c1", "m1")).rejects.toMatchObject({ response: { code: "message_not_found" } });
    const missing = build({ findMessage: jest.fn().mockResolvedValue(null) });
    await expect(missing.service.deleteMessage("me", "c1", "m1")).rejects.toBeInstanceOf(NotFoundException);
    expect(theirs.repo.deleteMessage).not.toHaveBeenCalled();
  });

  it("is only for members of the conversation", async () => {
    const { service } = build({ membership: jest.fn().mockResolvedValue(null) });
    await expect(service.deleteMessage("me", "c1", "m1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
