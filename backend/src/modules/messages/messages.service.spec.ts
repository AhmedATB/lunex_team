import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import type { AttachmentsService } from "../attachments/attachments.service";
import type { PushService } from "../push/push.service";
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
    createMessage: jest.fn(async (d: { conversationId: string; senderId: string; text: string; attachmentIds?: string[] }) => {
      const { attachmentIds, ...rest } = d;
      return { id: "m1", createdAt: new Date(), editedAt: null, attachments: (attachmentIds ?? []).map((id) => ({ id, width: 800, height: 600 })), ...rest };
    }),
    markRead: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    blockedAmong: jest.fn().mockResolvedValue([]),
    directPeer: jest.fn().mockResolvedValue(null),
    findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c1", senderId: "me", createdAt: new Date(), _count: { attachments: 0 } }),
    deleteMessage: jest.fn().mockResolvedValue(undefined),
    updateMessageText: jest.fn(async (id: string, text: string) => ({ id, senderId: "me", text, createdAt: new Date(), editedAt: new Date() })),
    updateTitle: jest.fn().mockResolvedValue({ id: "c1" }),
    setPhoto: jest.fn().mockResolvedValue({ conversationId: "c1" }),
    removePhoto: jest.fn().mockResolvedValue({ count: 1 }),
    findPhoto: jest.fn().mockResolvedValue(null),
    removeMember: jest.fn().mockResolvedValue(undefined),
    setMemberRole: jest.fn().mockResolvedValue(undefined),
    addBlock: jest.fn().mockResolvedValue(undefined),
    removeBlock: jest.fn().mockResolvedValue(undefined),
    listBlocked: jest.fn().mockResolvedValue([{ createdAt: new Date("2026-09-26T00:00:00Z"), blocked: person("sara") }]),
    ...overrides,
  };
  const attachments = {
    claimable: jest.fn(async (_actor: string, ids: string[] | undefined) => (ids ?? []).map((id) => ({ id, width: 800, height: 600 }))),
  };
  const push = { newMessage: jest.fn().mockResolvedValue(undefined) };
  return { service: new MessagesService(repo as unknown as MessagesRepository, attachments as unknown as AttachmentsService, push as unknown as PushService), repo, attachments, push };
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

describe("editing a message", () => {
  it("lets the writer correct their own message, and marks it edited", async () => {
    const { service, repo } = build();
    const edited = await service.editMessage("me", "c1", "m1", { text: "  النص الصحيح " });
    expect(repo.updateMessageText).toHaveBeenCalledWith("m1", "النص الصحيح");
    expect(edited).toMatchObject({ id: "m1", text: "النص الصحيح" });
    expect(edited.editedAt).toBeInstanceOf(Date);
  });

  it("never lets anyone edit another person's message, or one from another conversation, and a blank text is refused", async () => {
    const theirs = build({ findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c1", senderId: "sara", createdAt: new Date() }) });
    await expect(theirs.service.editMessage("me", "c1", "m1", { text: "x" })).rejects.toBeInstanceOf(ForbiddenException);
    const elsewhere = build({ findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c2", senderId: "me", createdAt: new Date() }) });
    await expect(elsewhere.service.editMessage("me", "c1", "m1", { text: "x" })).rejects.toMatchObject({ response: { code: "message_not_found" } });
    await expect(build().service.editMessage("me", "c1", "m1", { text: "   " })).rejects.toMatchObject({ response: { code: "empty_message" } });
    expect(theirs.repo.updateMessageText).not.toHaveBeenCalled();
  });

  it("is only for a day after sending, only for members, and not while muted", async () => {
    const old = build({ findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c1", senderId: "me", createdAt: new Date(Date.now() - 25 * 3_600_000) }) });
    await expect(old.service.editMessage("me", "c1", "m1", { text: "x" })).rejects.toMatchObject({ response: { code: "edit_window_closed" } });
    await expect(build({ membership: jest.fn().mockResolvedValue(null) }).service.editMessage("me", "c1", "m1", { text: "x" })).rejects.toBeInstanceOf(NotFoundException);
    const muted = build({ findActor: jest.fn().mockResolvedValue({ id: "me", isBanned: false, bannedUntil: null, mutedUntil: new Date(Date.now() + 3_600_000) }) });
    await expect(muted.service.editMessage("me", "c1", "m1", { text: "x" })).rejects.toMatchObject({ response: { code: "muted" } });
  });
});

describe("messages with pictures", () => {
  it("sends the pictures with the words, in the order they were added, and returns them", async () => {
    const { service, repo, attachments } = build();
    const message = await service.send("me", "c1", { text: " look ", imageIds: ["a", "b", "c"] });
    expect(attachments.claimable).toHaveBeenCalledWith("me", ["a", "b", "c"], 10);
    expect(repo.createMessage).toHaveBeenCalledWith({ conversationId: "c1", senderId: "me", text: "look", attachmentIds: ["a", "b", "c"] });
    expect(message.images.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("lets pictures stand alone, but not a message with neither words nor pictures", async () => {
    const { service, repo } = build();
    await expect(service.send("me", "c1", { imageIds: ["a"] })).resolves.toMatchObject({ text: "" });
    expect(repo.createMessage).toHaveBeenCalledWith(expect.objectContaining({ text: "", attachmentIds: ["a"] }));
    await expect(service.send("me", "c1", { text: "  " })).rejects.toMatchObject({ response: { code: "empty_message" } });
    await expect(service.send("me", "c1", {})).rejects.toMatchObject({ response: { code: "empty_message" } });
  });

  it("sends nothing when a picture cannot be used", async () => {
    const { service, repo, attachments } = build();
    attachments.claimable.mockRejectedValue(new BadRequestException({ code: "invalid_attachment", message: "gone" }));
    await expect(service.send("me", "c1", { text: "hi", imageIds: ["a"] })).rejects.toMatchObject({ response: { code: "invalid_attachment" } });
    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it("lets a message that has pictures be edited down to no words, but not one that has none", async () => {
    const plain = build();
    await expect(plain.service.editMessage("me", "c1", "m1", { text: " " })).rejects.toMatchObject({ response: { code: "empty_message" } });

    const withPictures = build({ findMessage: jest.fn().mockResolvedValue({ id: "m1", conversationId: "c1", senderId: "me", createdAt: new Date(), _count: { attachments: 2 } }) });
    await withPictures.service.editMessage("me", "c1", "m1", { text: " " });
    expect(withPictures.repo.updateMessageText).toHaveBeenCalledWith("m1", "");
  });

  it("marks in the chat list that the newest message carries pictures", async () => {
    const row = conversationRow({ messages: [{ id: "m1", senderId: "sara", text: "", createdAt: new Date(), _count: { attachments: 3 } }] });
    const { service } = build({ listFor: jest.fn().mockResolvedValue([row]) });
    const { conversations } = await service.list("me");
    expect(conversations[0].lastMessage).toMatchObject({ text: "", imageCount: 3 });
  });
});

/** A group of four: "boss" started it, "adm" is an admin, "sara" and "omar" are ordinary members. */
const groupRow = (overrides: Record<string, unknown> = {}) =>
  conversationRow({
    isGroup: true,
    createdById: "boss",
    members: [
      { userId: "boss", role: "member", user: person("boss") },
      { userId: "adm", role: "admin", user: person("adm") },
      { userId: "sara", role: "member", user: person("sara") },
      { userId: "omar", role: "member", user: person("omar") },
    ],
    ...overrides,
  });
const asGroup = (actor: string, overrides: Record<string, unknown> = {}) =>
  build({
    findActor: jest.fn().mockResolvedValue({ id: actor, isBanned: false, bannedUntil: null, mutedUntil: null }),
    membership: jest.fn().mockResolvedValue({ conversationId: "c1", userId: actor }),
    findConversation: jest.fn().mockResolvedValue(groupRow()),
    ...overrides,
  });

describe("who is what in a group", () => {
  it("shows each member's standing — the one who started it is the owner, the others admin or member — and whether it has a picture", async () => {
    const { service } = asGroup("sara", { findConversation: jest.fn().mockResolvedValue(groupRow({ photo: { updatedAt: new Date("2026-09-20T00:00:00Z") } })) });
    const { conversations } = await asGroup("sara", { listFor: jest.fn().mockResolvedValue([groupRow({ photo: { updatedAt: new Date("2026-09-20T00:00:00Z") } })]) }).service.list("sara");
    expect(conversations[0].members.map((m) => [m.id, m.role])).toEqual([["boss", "owner"], ["adm", "admin"], ["sara", "member"], ["omar", "member"]]);
    expect(conversations[0].photoVersion).toBe("2026-09-20T00:00:00.000Z");
    void service;
  });

  it("has no standings in a chat between two people, and no picture", async () => {
    const { conversations } = await build().service.list("me");
    expect(conversations[0].members.every((m) => m.role === "member")).toBe(true);
    expect(conversations[0].photoVersion).toBeNull();
  });
});

describe("managing a group", () => {
  it("lets the owner and an admin add people, but not an ordinary member", async () => {
    await expect(asGroup("boss").service.addMembers("boss", "c1", { usernames: ["sara"] })).resolves.toBeDefined();
    await expect(asGroup("adm").service.addMembers("adm", "c1", { usernames: ["sara"] })).resolves.toBeDefined();
    await expect(asGroup("sara").service.addMembers("sara", "c1", { usernames: ["omar"] })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets the owner and an admin change the name (an empty one takes it off), and no one else", async () => {
    const owner = asGroup("boss");
    await owner.service.updateGroup("boss", "c1", { title: "  فريق الترجمة " });
    expect(owner.repo.updateTitle).toHaveBeenCalledWith("c1", "فريق الترجمة");
    const admin = asGroup("adm");
    await admin.service.updateGroup("adm", "c1", { title: "   " });
    expect(admin.repo.updateTitle).toHaveBeenCalledWith("c1", null);
    const member = asGroup("sara");
    await expect(member.service.updateGroup("sara", "c1", { title: "x" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(member.repo.updateTitle).not.toHaveBeenCalled();
    await expect(build().service.updateGroup("me", "c1", { title: "x" })).rejects.toMatchObject({ response: { code: "not_a_group" } });
  });

  it("crops a group's picture to a small square WebP, for the owner and admins only, and refuses what is not a picture", async () => {
    const photo = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#aa3366" } }).jpeg().toBuffer();
    const { service, repo } = asGroup("adm");
    await service.setGroupPhoto("adm", "c1", { buffer: photo } as Express.Multer.File);
    const saved = repo.setPhoto.mock.calls[0][1] as Buffer;
    const meta = await sharp(saved).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);
    await expect(service.setGroupPhoto("adm", "c1", { buffer: Buffer.from("nope") } as Express.Multer.File)).rejects.toMatchObject({ response: { code: "invalid_image" } });
    await expect(service.setGroupPhoto("adm", "c1", undefined)).rejects.toMatchObject({ response: { code: "no_file" } });
    await expect(asGroup("sara").service.setGroupPhoto("sara", "c1", { buffer: photo } as Express.Multer.File)).rejects.toBeInstanceOf(ForbiddenException);
    await service.removeGroupPhoto("adm", "c1");
    expect(repo.removePhoto).toHaveBeenCalledWith("c1");
  });

  it("shows a group's picture to its members only, and says so plainly when there is none", async () => {
    const withPhoto = asGroup("sara", { findPhoto: jest.fn().mockResolvedValue({ data: Buffer.from("img") }) });
    expect((await withPhoto.service.groupPhoto("sara", "c1")).data.toString()).toBe("img");
    await expect(asGroup("sara").service.groupPhoto("sara", "c1")).rejects.toMatchObject({ response: { code: "image_not_found" } });
    const outsider = asGroup("stranger", { membership: jest.fn().mockResolvedValue(null) });
    await expect(outsider.service.groupPhoto("stranger", "c1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets the owner remove anyone, and an admin only ordinary members — never the owner, another admin, or themselves", async () => {
    const owner = asGroup("boss");
    await owner.service.removeMember("boss", "c1", "adm");
    expect(owner.repo.removeMember).toHaveBeenCalledWith("c1", "adm");

    const admin = asGroup("adm");
    await admin.service.removeMember("adm", "c1", "sara");
    expect(admin.repo.removeMember).toHaveBeenCalledWith("c1", "sara");
    admin.repo.removeMember.mockClear();
    await expect(admin.service.removeMember("adm", "c1", "boss")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(admin.service.removeMember("adm", "c1", "adm")).rejects.toMatchObject({ response: { code: "use_leave" } });
    const twoAdmins = asGroup("adm", { findConversation: jest.fn().mockResolvedValue(groupRow({ members: [{ userId: "boss", role: "member", user: person("boss") }, { userId: "adm", role: "admin", user: person("adm") }, { userId: "adm2", role: "admin", user: person("adm2") }] })) });
    await expect(twoAdmins.service.removeMember("adm", "c1", "adm2")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(admin.service.removeMember("adm", "c1", "ghost")).rejects.toMatchObject({ response: { code: "member_not_found" } });
    expect(admin.repo.removeMember).not.toHaveBeenCalled();

    const member = asGroup("sara");
    await expect(member.service.removeMember("sara", "c1", "omar")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets only the owner make someone an admin or take it off — and never touches the owner's own standing", async () => {
    const owner = asGroup("boss");
    await owner.service.setMemberRole("boss", "c1", "sara", { role: "admin" });
    expect(owner.repo.setMemberRole).toHaveBeenCalledWith("c1", "sara", "admin");
    await expect(owner.service.setMemberRole("boss", "c1", "boss", { role: "member" })).rejects.toMatchObject({ response: { code: "cannot_change_owner" } });
    await expect(owner.service.setMemberRole("boss", "c1", "ghost", { role: "admin" })).rejects.toMatchObject({ response: { code: "member_not_found" } });
    const admin = asGroup("adm");
    await expect(admin.service.setMemberRole("adm", "c1", "sara", { role: "admin" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(admin.repo.setMemberRole).not.toHaveBeenCalled();
  });

  it("treats a conversation the caller is not in as nonexistent for all of this", async () => {
    const outsider = asGroup("stranger", { membership: jest.fn().mockResolvedValue(null) });
    await expect(outsider.service.updateGroup("stranger", "c1", { title: "x" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(outsider.service.removeMember("stranger", "c1", "sara")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("messages that also reach a phone", () => {
  it("tells the other people of the chat, with what was written and how many pictures", async () => {
    const { service, push } = build();
    await service.send("me", "c1", { text: " مرحبًا ", imageIds: ["a", "b"] });
    expect(push.newMessage).toHaveBeenCalledWith("c1", "me", "مرحبًا", 2);
  });

  it("does not tell anyone about a message that was refused, and is not held up or undone by a failing push", async () => {
    const refused = build();
    await expect(refused.service.send("me", "c1", { text: "  " })).rejects.toBeDefined();
    expect(refused.push.newMessage).not.toHaveBeenCalled();
    const failing = build();
    failing.push.newMessage.mockRejectedValue(new Error("push down"));
    await expect(failing.service.send("me", "c1", { text: "hi" })).resolves.toMatchObject({ text: "hi" });
  });
});
