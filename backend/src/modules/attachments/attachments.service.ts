import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import { activeMutedUntil, isEffectivelyBanned, isMuted } from "../moderation/moderation.util";
import { AttachmentsRepository } from "./attachments.repository";

/** The full picture fits inside this many pixels on a side; the small one (for lists) inside the other. */
const FULL_MAX = 1600;
const THUMB_MAX = 480;
/** More than this many pixels in the original is refused before it is decoded (a small file can unpack into a huge picture). */
const MAX_INPUT_PIXELS = 50_000_000;
/** What is accepted. A vector picture (SVG) or a document is refused, whatever it is called. */
const FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);
/** A member can have this many uploaded pictures waiting for a comment or message, and can upload this many in a day. */
const MAX_WAITING = 12;
const MAX_PER_DAY = 100;
const DAY_MS = 86_400_000;
/** An uploaded picture can join a comment or message for this long after it was uploaded. */
const CLAIM_WINDOW_MS = DAY_MS;

export interface AttachmentDto {
  id: string;
  width: number;
  height: number;
}

export interface AttachmentImage {
  data: Buffer;
  mimeType: string;
  /** A picture on a comment is as public as the comment; the others are for their own people only, so nothing shared may keep them. */
  publicCache: boolean;
}

/**
 * Pictures that go with comments and chat messages. They are uploaded first (checked, cleaned of everything but the picture,
 * resized and re-encoded as WebP), come back as an id, and join a comment or message when it is sent. Who may see one follows where it
 * ended up: anyone for a comment's, the members of the chat for a message's, only the uploader while it waits.
 */
@Injectable()
export class AttachmentsService {
  constructor(private readonly repo: AttachmentsRepository) {}

  async upload(actorId: string, file: Express.Multer.File | undefined): Promise<AttachmentDto> {
    const actor = await this.repo.findActor(actorId);
    if (!actor) throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    if (isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account has been banned." });
    if (isMuted(actor)) throw new ForbiddenException({ code: "account_muted", message: `You are in a timeout until ${activeMutedUntil(actor)}.` });
    if (!file?.buffer?.length) throw new BadRequestException({ code: "no_file", message: "Choose a picture first." });

    const { total, waiting } = await this.repo.countUploads(actorId, new Date(Date.now() - DAY_MS));
    if (waiting >= MAX_WAITING || total >= MAX_PER_DAY) {
      throw new HttpException({ code: "upload_limit", message: "Too many pictures uploaded. Try again later." }, HttpStatus.TOO_MANY_REQUESTS);
    }

    let processed: { full: Buffer; thumb: Buffer; width: number; height: number };
    try {
      const source = sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
      const format = (await source.metadata()).format;
      if (!format || !FORMATS.has(format)) throw new Error("format");
      // `rotate()` applies the camera's orientation; nothing else of the original (location, camera, time) is kept.
      const oriented = sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
      const full = await oriented.clone().resize({ width: FULL_MAX, height: FULL_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
      const thumb = await oriented.clone().resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
      processed = { full: full.data, thumb, width: full.info.width, height: full.info.height };
    } catch {
      throw new BadRequestException({ code: "invalid_image", message: "This file could not be read as a picture." });
    }

    return this.repo.create({ userId: actorId, width: processed.width, height: processed.height, full: processed.full, thumb: processed.thumb });
  }

  /**
   * Checks that these pictures are the caller's own, still waiting, and recent enough, and returns them in the order they were
   * uploaded — before the comment or message that takes them is written. `max` is how many that one may carry.
   */
  async claimable(actorId: string, ids: string[] | undefined, max: number): Promise<AttachmentDto[]> {
    const wanted = [...new Set(ids ?? [])];
    if (wanted.length === 0) return [];
    if (wanted.length > max) {
      throw new BadRequestException({ code: "too_many_images", message: max === 1 ? "Only one picture can go with a comment." : `At most ${max} pictures can go with one message.` });
    }
    const rows = await this.repo.findMany(wanted);
    const now = Date.now();
    const fresh = rows.every((r) => r.userId === actorId && r.commentId === null && r.messageId === null && now - r.createdAt.getTime() < CLAIM_WINDOW_MS);
    if (rows.length !== wanted.length || !fresh) {
      throw new BadRequestException({ code: "invalid_attachment", message: "One of the pictures is no longer available. Add it again." });
    }
    return rows.map((r) => ({ id: r.id, width: r.width, height: r.height }));
  }

  /** The picture for a viewer (a guest has no id): 404 for anyone who may not see it, so its existence is not theirs to learn either. */
  async view(viewerId: string | undefined, id: string, size: "thumb" | "full"): Promise<AttachmentImage> {
    const row = await this.repo.findForServing(id);
    const missing = new NotFoundException({ code: "image_not_found", message: "This picture does not exist." });
    if (!row?.blob) throw missing;

    let publicCache = false;
    if (row.commentId) {
      if (!row.comment || row.comment.deletedAt) throw missing; // a comment a moderator removed takes its picture with it
      publicCache = true;
    } else if (row.messageId) {
      if (!viewerId || !row.message || !(await this.repo.isMember(row.message.conversationId, viewerId))) throw missing;
    } else if (row.userId !== viewerId) {
      throw missing;
    }
    return { data: Buffer.from(size === "thumb" ? row.blob.thumb : row.blob.data), mimeType: "image/webp", publicCache };
  }
}
