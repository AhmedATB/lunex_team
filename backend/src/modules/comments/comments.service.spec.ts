import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { NotificationsService } from "../notifications/notifications.service";
import { cleanCommentText } from "./comment-text.util";
import type { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";
import { MAX_COMMENT_LENGTH } from "./dto/comment.dto";

const CTX = { ip: "203.0.113.4" } as RequestContext;
const HOUR = 60 * 60 * 1000;

describe("cleanCommentText", () => {
  it("trims and normalises line breaks and blank runs", () => {
    expect(cleanCommentText("  hello  \r\n\r\n\r\n\r\nworld  ")).toBe("hello\n\nworld");
  });

  it("strips zero-width, bidi and control characters", () => {
    const sneaky = "hi​‮ there\u0007﻿";
    expect(cleanCommentText(sneaky)).toBe("hi there");
  });

  it("returns null for empty or invisible-only text", () => {
    expect(cleanCommentText("   \n\t ")).toBeNull();
    expect(cleanCommentText("​​")).toBeNull();
  });

  it("keeps Arabic text intact", () => {
    expect(cleanCommentText("  فصل رائع، شكراً للفريق  ")).toBe("فصل رائع، شكراً للفريق");
  });

  it("does not truncate", () => {
    expect(cleanCommentText("x".repeat(5000))).toHaveLength(5000);
  });
});

const author = (id: string, role = "reader") => ({ id, username: id, displayName: null, role, updatedAt: new Date(), avatarMimeType: null });

function commentRow(id: string, userId: string, role = "reader", extra: Record<string, unknown> = {}) {
  return {
    id,
    seriesId: "series-1",
    userId,
    content: "hello",
    isSpoiler: false,
    isPinned: false,
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
    user: author(userId, role),
    ...extra,
  };
}

function build(users: Record<string, { role: string; isBanned?: boolean; bannedUntil?: Date | null; mutedUntil?: Date | null }>) {
  const actors = new Map(
    Object.entries(users).map(([id, u]) => [id, { id, role: u.role, isBanned: u.isBanned ?? false, bannedUntil: u.bannedUntil ?? null, mutedUntil: u.mutedUntil ?? null }])
  );
  const repo = {
    findActor: jest.fn(async (id: string) => actors.get(id) ?? null),
    findById: jest.fn(),
    countByAuthorSince: jest.fn().mockResolvedValue(0),
    findRecentDuplicate: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (d: { seriesId: string; userId: string; content: string; isSpoiler: boolean }) =>
      commentRow("new", d.userId, "reader", { content: d.content, isSpoiler: d.isSpoiler })
    ),
    update: jest.fn(async (id: string, patch: Record<string, unknown>) => commentRow(id, "author", "reader", patch)),
    hardDelete: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    reactionCounts: jest.fn().mockResolvedValue([]),
    viewerReactions: jest.fn().mockResolvedValue([]),
    setReaction: jest.fn().mockResolvedValue(undefined),
    clearReaction: jest.fn().mockResolvedValue(undefined),
    upsertReport: jest.fn().mockResolvedValue(undefined),
    dismissReports: jest.fn().mockResolvedValue(undefined),
    reportedComments: jest.fn().mockResolvedValue([]),
    listForSeries: jest.fn().mockResolvedValue([]),
    listLatest: jest.fn().mockResolvedValue([]),
    writeAuditLog: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new CommentsService(repo as unknown as CommentsRepository, notifications as unknown as NotificationsService);
  return { service, repo, notifications };
}

const roster = () => ({
  author: { role: "reader" },
  other: { role: "reader" },
  mod: { role: "moderator" },
  admin: { role: "super_administrator" },
  editor: { role: "editor" },
});

describe("CommentsService.create", () => {
  it("posts a cleaned comment for an ordinary member", async () => {
    const { service, repo } = build(roster());
    await service.create("author", { seriesId: "series-1", content: "  great chapter  ", isSpoiler: true });
    expect(repo.create).toHaveBeenCalledWith({ seriesId: "series-1", userId: "author", content: "great chapter", isSpoiler: true });
  });

  it("refuses a timed-out account, telling it until when", async () => {
    const until = new Date(Date.now() + HOUR);
    const { service, repo } = build({ ...roster(), muted: { role: "reader", mutedUntil: until } });
    await expect(service.create("muted", { seriesId: "series-1", content: "hello" })).rejects.toMatchObject({
      response: { code: "account_muted", message: expect.stringContaining(until.toISOString()) },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("lets an account whose timeout has ended post again", async () => {
    const { service } = build({ ...roster(), back: { role: "reader", mutedUntil: new Date(Date.now() - HOUR) } });
    await expect(service.create("back", { seriesId: "series-1", content: "hello" })).resolves.toBeDefined();
  });

  it("refuses a banned account", async () => {
    const { service } = build({ ...roster(), bad: { role: "reader", isBanned: true } });
    await expect(service.create("bad", { seriesId: "series-1", content: "hello" })).rejects.toMatchObject({ response: { code: "account_banned" } });
  });

  it("404s an account that no longer exists", async () => {
    const { service } = build(roster());
    await expect(service.create("ghost", { seriesId: "series-1", content: "hello" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects empty and over-long text instead of silently cutting it", async () => {
    const { service, repo } = build(roster());
    await expect(service.create("author", { seriesId: "series-1", content: " ​ " })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create("author", { seriesId: "series-1", content: "x".repeat(MAX_COMMENT_LENGTH + 1) })).rejects.toMatchObject({
      response: { code: "comment_too_long" },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rate-limits per account, per minute and per hour", async () => {
    const { service, repo } = build(roster());
    repo.countByAuthorSince.mockResolvedValueOnce(5);
    await expect(service.create("author", { seriesId: "series-1", content: "hello" })).rejects.toMatchObject({ status: 429 });
    repo.countByAuthorSince.mockResolvedValueOnce(0).mockResolvedValueOnce(60);
    await expect(service.create("author", { seriesId: "series-1", content: "hello" })).rejects.toBeInstanceOf(HttpException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("refuses an identical comment posted moments ago", async () => {
    const { service, repo } = build(roster());
    repo.findRecentDuplicate.mockResolvedValue({ id: "earlier" });
    await expect(service.create("author", { seriesId: "series-1", content: "hello" })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("CommentsService.update", () => {
  it("lets the author edit the text and marks it edited", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await service.update("author", "c1", { content: "changed" });
    expect(repo.update).toHaveBeenCalledWith("c1", expect.objectContaining({ content: "changed", editedAt: expect.any(Date) }));
  });

  it("does not mark an unchanged text as edited", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await service.update("author", "c1", { content: "hello" });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("never lets anyone else, staff included, rewrite someone's words", async () => {
    const { service } = build(roster());
    for (const actor of ["other", "mod", "admin"]) {
      const { service: s, repo } = build(roster());
      repo.findById.mockResolvedValue(commentRow("c1", "author"));
      await expect(s.update(actor, "c1", { content: "forged" })).rejects.toMatchObject({ response: { code: "not_comment_author" } });
    }
    expect(service).toBeDefined();
  });

  it("does not let a timed-out author edit through the back door", async () => {
    const { service, repo } = build({ ...roster(), muted: { role: "reader", mutedUntil: new Date(Date.now() + HOUR) } });
    repo.findById.mockResolvedValue(commentRow("c1", "muted"));
    await expect(service.update("muted", "c1", { content: "sneaky" })).rejects.toMatchObject({ response: { code: "account_muted" } });
  });

  it("lets only staff pin", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await expect(service.update("author", "c1", { isPinned: true })).rejects.toBeInstanceOf(ForbiddenException);
    await service.update("mod", "c1", { isPinned: true });
    expect(repo.update).toHaveBeenCalledWith("c1", { isPinned: true });
  });

  it("lets the author or staff mark a spoiler, but not a stranger", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await service.update("author", "c1", { isSpoiler: true });
    await service.update("mod", "c1", { isSpoiler: true });
    await expect(service.update("other", "c1", { isSpoiler: true })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("404s a comment a moderator already removed", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author", "reader", { deletedAt: new Date() }));
    await expect(service.update("author", "c1", { content: "x" })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("CommentsService.remove", () => {
  it("deletes the author's own comment for good, with no notification", async () => {
    const { service, repo, notifications } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await service.remove("author", "c1", CTX);
    expect(repo.hardDelete).toHaveBeenCalledWith("c1");
    expect(repo.softDelete).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("lets staff remove someone else's comment softly, audit it, and tell the author", async () => {
    const { service, repo, notifications } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await service.remove("mod", "c1", CTX);
    expect(repo.softDelete).toHaveBeenCalledWith("c1", "mod");
    expect(repo.hardDelete).not.toHaveBeenCalled();
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorId: "mod", action: "comment.removed" }));
    expect(notifications.notify).toHaveBeenCalledWith("author", "moderation", expect.any(String), expect.any(String), "/terms");
  });

  it("refuses non-staff removing another member's comment", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await expect(service.remove("other", "c1", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove("editor", "c1", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it("stops a moderator removing an administrator's comment", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "admin", "super_administrator"));
    await expect(service.remove("mod", "c1", CTX)).rejects.toMatchObject({ response: { code: "cannot_moderate_higher_rank" } });
    await service.remove("admin", "c1", CTX);
  });
});

describe("CommentsService reactions and reports", () => {
  it("records a reaction and returns fresh counts", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    repo.reactionCounts.mockResolvedValue([{ commentId: "c1", kind: "like", _count: { _all: 3 } }, { commentId: "c1", kind: "dislike", _count: { _all: 1 } }]);
    repo.viewerReactions.mockResolvedValue([{ commentId: "c1", kind: "like" }]);
    const result = await service.react("other", "c1", "like");
    expect(repo.setReaction).toHaveBeenCalledWith("c1", "other", "like");
    expect(result).toEqual({ likes: 3, dislikes: 1, myReaction: "like" });
  });

  it("clears a reaction on 'none' and refuses reacting to your own comment", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await service.react("other", "c1", "none");
    expect(repo.clearReaction).toHaveBeenCalledWith("c1", "other");
    await expect(service.react("author", "c1", "like")).rejects.toMatchObject({ response: { code: "cannot_react_own" } });
  });

  it("files a report but not against your own comment", async () => {
    const { service, repo } = build(roster());
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await service.report("other", "c1", "  abusive language ");
    expect(repo.upsertReport).toHaveBeenCalledWith("c1", "other", "abusive language");
    await expect(service.report("author", "c1", "whatever")).rejects.toMatchObject({ response: { code: "cannot_report_own" } });
  });

  it("keeps the report queue and dismissal to staff", async () => {
    const { service, repo } = build(roster());
    await expect(service.reportQueue("other")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reportQueue("editor")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reportQueue("mod")).resolves.toEqual({ items: [] });
    repo.findById.mockResolvedValue(commentRow("c1", "author"));
    await expect(service.dismissReports("other", "c1", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await service.dismissReports("mod", "c1", CTX);
    expect(repo.dismissReports).toHaveBeenCalledWith("c1");
  });
});

describe("CommentsService reads", () => {
  it("attaches counts, the viewer's reaction and a safe author to each comment", async () => {
    const { service, repo } = build(roster());
    repo.listForSeries.mockResolvedValue([commentRow("c1", "author"), commentRow("c2", "other")]);
    repo.reactionCounts.mockResolvedValue([{ commentId: "c2", kind: "like", _count: { _all: 2 } }]);
    repo.viewerReactions.mockResolvedValue([{ commentId: "c2", kind: "dislike" }]);
    const { comments } = await service.listForSeries("series-1", "viewer");
    expect(comments[0]).toMatchObject({ id: "c1", likes: 0, dislikes: 0, myReaction: null });
    expect(comments[1]).toMatchObject({ id: "c2", likes: 2, myReaction: "dislike" });
    expect(JSON.stringify(comments)).not.toMatch(/email|passwordHash|avatarImage/);
    expect(comments[0].author).toEqual({ id: "author", username: "author", displayName: "author", role: "reader", avatarVersion: null });
  });

  it("does not look up a viewer's reactions for an anonymous reader", async () => {
    const { service, repo } = build(roster());
    repo.listForSeries.mockResolvedValue([commentRow("c1", "author")]);
    await service.listForSeries("series-1", undefined);
    expect(repo.viewerReactions).not.toHaveBeenCalled();
  });

  it("clamps the latest-comments limit", async () => {
    const { service, repo } = build(roster());
    await service.latest(9999);
    expect(repo.listLatest).toHaveBeenCalledWith(30);
    await service.latest(-4);
    expect(repo.listLatest).toHaveBeenLastCalledWith(1);
  });
});
