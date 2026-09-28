import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import type { AttachmentsRepository } from "./attachments.repository";
import { AttachmentsService } from "./attachments.service";

const NOW = Date.now();

function build(options: { muted?: boolean; banned?: boolean; uploads?: { total: number; waiting: number }; rows?: Record<string, unknown>[]; serving?: Record<string, unknown> | null; member?: boolean } = {}) {
  const repo = {
    findActor: jest.fn(async () => ({ id: "me", isBanned: options.banned ?? false, bannedUntil: null, mutedUntil: options.muted ? new Date(NOW + 3_600_000) : null })),
    countUploads: jest.fn(async () => options.uploads ?? { total: 0, waiting: 0 }),
    create: jest.fn(async (d: { width: number; height: number }) => ({ id: "att-1", width: d.width, height: d.height })),
    findMany: jest.fn(async () => options.rows ?? []),
    findForServing: jest.fn(async () => options.serving ?? null),
    isMember: jest.fn(async () => options.member ?? false),
  };
  return { service: new AttachmentsService(repo as unknown as AttachmentsRepository), repo };
}

const file = (buffer: Buffer) => ({ buffer, originalname: "x.jpg", mimetype: "image/jpeg" }) as unknown as Express.Multer.File;
const jpeg = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 90 } } }).jpeg().toBuffer();
const row = (id: string, overrides: Record<string, unknown> = {}) => ({ id, userId: "me", commentId: null, messageId: null, createdAt: new Date(NOW - 60_000), width: 800, height: 600, ...overrides });

describe("uploading a picture", () => {
  it("re-encodes it as WebP inside 1600 px, makes a small one for lists, and keeps only the picture", async () => {
    const { service, repo } = build();
    const dto = await service.upload("me", file(await jpeg(3200, 2000)));
    expect(dto).toEqual({ id: "att-1", width: 1600, height: 1000 });
    const saved = repo.create.mock.calls[0][0] as unknown as { full: Buffer; thumb: Buffer };
    const full = await sharp(saved.full).metadata();
    const thumb = await sharp(saved.thumb).metadata();
    expect([full.format, full.width, full.height]).toEqual(["webp", 1600, 1000]);
    expect([thumb.format, thumb.width, thumb.height]).toEqual(["webp", 480, 300]);
    expect(full.exif).toBeUndefined();
  });

  it("does not enlarge a small picture", async () => {
    const { service } = build();
    expect(await service.upload("me", file(await jpeg(300, 200)))).toMatchObject({ width: 300, height: 200 });
  });

  it("turns a picture the camera saved sideways the right way up", async () => {
    const sideways = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#123456" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const { service } = build();
    expect(await service.upload("me", file(sideways))).toMatchObject({ width: 200, height: 400 });
  });

  it("refuses what is not a picture, and a vector picture", async () => {
    const { service, repo } = build();
    await expect(service.upload("me", file(Buffer.from("not an image at all")))).rejects.toMatchObject({ response: { code: "invalid_image" } });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>');
    await expect(service.upload("me", file(svg))).rejects.toMatchObject({ response: { code: "invalid_image" } });
    await expect(service.upload("me", undefined)).rejects.toMatchObject({ response: { code: "no_file" } });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("is not for a banned or timed-out account, and stops at the limits", async () => {
    await expect(build({ banned: true }).service.upload("me", file(await jpeg(10, 10)))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build({ muted: true }).service.upload("me", file(await jpeg(10, 10)))).rejects.toMatchObject({ response: { code: "account_muted" } });
    await expect(build({ uploads: { total: 5, waiting: 12 } }).service.upload("me", file(await jpeg(10, 10)))).rejects.toBeInstanceOf(HttpException);
    await expect(build({ uploads: { total: 100, waiting: 0 } }).service.upload("me", file(await jpeg(10, 10)))).rejects.toMatchObject({ response: { code: "upload_limit" } });
  });
});

describe("attaching pictures to a comment or message", () => {
  it("accepts the caller's own waiting pictures, in the order they were uploaded", async () => {
    const { service } = build({ rows: [row("a"), row("b")] });
    expect(await service.claimable("me", ["b", "a"], 10)).toEqual([
      { id: "a", width: 800, height: 600 },
      { id: "b", width: 800, height: 600 },
    ]);
  });

  it("is nothing to check when there are none", async () => {
    const { service, repo } = build();
    expect(await service.claimable("me", undefined, 1)).toEqual([]);
    expect(await service.claimable("me", [], 1)).toEqual([]);
    expect(repo.findMany).not.toHaveBeenCalled();
  });

  it("refuses more than one asks for", async () => {
    const { service } = build({ rows: [row("a"), row("b")] });
    await expect(service.claimable("me", ["a", "b"], 1)).rejects.toMatchObject({ response: { code: "too_many_images" } });
  });

  it("refuses someone else's picture, one already in use, one that is gone, and one uploaded long ago", async () => {
    await expect(build({ rows: [row("a", { userId: "sara" })] }).service.claimable("me", ["a"], 1)).rejects.toMatchObject({ response: { code: "invalid_attachment" } });
    await expect(build({ rows: [row("a", { commentId: "c1" })] }).service.claimable("me", ["a"], 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ rows: [row("a", { messageId: "m1" })] }).service.claimable("me", ["a"], 5)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ rows: [] }).service.claimable("me", ["a"], 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ rows: [row("a", { createdAt: new Date(NOW - 25 * 3_600_000) })] }).service.claimable("me", ["a"], 1)).rejects.toMatchObject({ response: { code: "invalid_attachment" } });
  });

  it("does not count the same picture twice", async () => {
    const { service } = build({ rows: [row("a")] });
    expect(await service.claimable("me", ["a", "a"], 1)).toHaveLength(1);
  });
});

describe("who may see a picture", () => {
  const blob = { data: Buffer.from("full"), thumb: Buffer.from("small") };

  it("shows a comment's picture to anyone — a visitor too — and lets shared caches keep it", async () => {
    const { service } = build({ serving: { userId: "sara", commentId: "c1", messageId: null, blob, comment: { deletedAt: null }, message: null } });
    const image = await service.view(undefined, "att", "full");
    expect(image).toMatchObject({ mimeType: "image/webp", publicCache: true });
    expect(image.data.toString()).toBe("full");
    expect((await service.view(undefined, "att", "thumb")).data.toString()).toBe("small");
  });

  it("hides the picture of a comment a moderator removed", async () => {
    const { service } = build({ serving: { userId: "sara", commentId: "c1", messageId: null, blob, comment: { deletedAt: new Date() }, message: null } });
    await expect(service.view("me", "att", "full")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("shows a message's picture only to the people of that chat, and never lets a shared cache keep it", async () => {
    const serving = { userId: "sara", commentId: null, messageId: "m1", blob, comment: null, message: { conversationId: "c1" } };
    const member = build({ serving, member: true });
    expect(await member.service.view("me", "att", "full")).toMatchObject({ publicCache: false });
    expect(member.repo.isMember).toHaveBeenCalledWith("c1", "me");
    await expect(build({ serving, member: false }).service.view("me", "att", "full")).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ serving, member: true }).service.view(undefined, "att", "full")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("shows a picture that is still waiting only to the one who uploaded it", async () => {
    const serving = { userId: "me", commentId: null, messageId: null, blob, comment: null, message: null };
    expect(await build({ serving }).service.view("me", "att", "thumb")).toMatchObject({ publicCache: false });
    await expect(build({ serving }).service.view("sara", "att", "thumb")).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ serving }).service.view(undefined, "att", "thumb")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("answers the same for a picture that does not exist", async () => {
    await expect(build({ serving: null }).service.view("me", "nope", "full")).rejects.toBeInstanceOf(NotFoundException);
  });
});
