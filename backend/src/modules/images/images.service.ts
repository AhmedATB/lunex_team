import { HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { ScrapingVelocityTracker } from "./anti-scraping/scraping-velocity.tracker";
import { ImageTokenSigner, NonceCache } from "./crypto/image-token.util";
import { ImagesRepository } from "./images.repository";
import { StorageService } from "./storage/local-storage.service";
import type { RequestContext } from "../../common/middleware/request-context.middleware";

export interface IssuedImageToken {
  token: string;
  expiresIn: number;
}

/**
 * Orchestration only, same shape as AuthService: repository owns Prisma,
 * StorageService owns bytes-on-disk, ImageTokenSigner owns crypto — this
 * class wires the three together into the actual security properties the
 * architecture doc calls for (short-lived, device-bound, single-use, per-
 * session-watermarked access).
 */
@Injectable()
export class ImagesService {
  private readonly signer: ImageTokenSigner;
  private readonly nonces = new NonceCache();
  private readonly velocity = new ScrapingVelocityTracker();

  constructor(
    private readonly repo: ImagesRepository,
    private readonly storage: StorageService,
    config: ConfigService
  ) {
    this.signer = new ImageTokenSigner(config.getOrThrow<string>("IMAGE_TOKEN_SECRET"));
  }

  async issueToken(assetId: string, userId: string, ctx: RequestContext): Promise<IssuedImageToken> {
    if (!this.velocity.record(ctx.deviceFingerprint, assetId)) {
      await this.reject(assetId, userId, ctx, "scraping_suspected");
      throw new HttpException(
        { code: "scraping_suspected", message: "Too many distinct pages requested too quickly." },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const asset = await this.repo.findAssetById(assetId);
    if (!asset) {
      throw new NotFoundException({ code: "asset_not_found", message: "Image asset not found." });
    }

    const token = this.signer.issue(assetId, userId, ctx.deviceFingerprint);
    await this.repo.logAccess({
      assetId,
      userId,
      deviceFingerprint: ctx.deviceFingerprint,
      ip: ctx.ip,
      event: "token_issued",
    });

    return { token, expiresIn: 60 };
  }

  async streamAsset(
    assetId: string,
    token: string | undefined,
    ctx: RequestContext
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!token) {
      throw new UnauthorizedException({ code: "missing_token", message: "Image access token required." });
    }

    const verified = this.signer.verify(token);
    if (!verified.ok) {
      await this.reject(assetId, undefined, ctx, verified.reason);
      throw new UnauthorizedException({
        code: `image_token_${verified.reason}`,
        message: "Invalid or expired image access token.",
      });
    }

    const { payload } = verified;

    if (payload.assetId !== assetId) {
      await this.reject(assetId, payload.userId, ctx, "asset_mismatch");
      throw new UnauthorizedException({ code: "image_token_asset_mismatch", message: "Token is not valid for this asset." });
    }
    // Bound to the device that requested the token — a URL copy-pasted
    // elsewhere (a different browser, a scraper with no fingerprint) fails
    // here even with a structurally valid, unexpired, correctly-signed token.
    if (payload.deviceFingerprint !== ctx.deviceFingerprint) {
      await this.reject(assetId, payload.userId, ctx, "device_mismatch");
      throw new UnauthorizedException({ code: "image_token_device_mismatch", message: "Token was not issued to this device." });
    }
    if (!this.nonces.consume(payload.nonce)) {
      await this.reject(assetId, payload.userId, ctx, "replayed");
      throw new UnauthorizedException({ code: "image_token_replayed", message: "This access token was already used." });
    }

    const asset = await this.repo.findAssetById(assetId);
    if (!asset) {
      throw new NotFoundException({ code: "asset_not_found", message: "Image asset not found." });
    }

    const original = await this.storage.get(asset.storageKey);
    const watermarked = await this.watermark(original, payload.userId);

    await this.repo.logAccess({
      assetId,
      userId: payload.userId,
      deviceFingerprint: ctx.deviceFingerprint,
      ip: ctx.ip,
      event: "stream_served",
    });

    return { buffer: watermarked, contentType: "image/png" };
  }

  /**
   * Tiled, semi-transparent overlay carrying the requesting user's id and the
   * exact serve time. Barely noticeable at normal reading size, but a leaked
   * page still carries enough signal (id + timestamp, repeated so cropping
   * can't remove every copy) to trace the leak back to one session. This is
   * deterrence through traceability, not prevention — the honest framing for
   * anything that ultimately has to render onto a screen a human can see.
   */
  private async watermark(original: Buffer, userId: string): Promise<Buffer> {
    const image = sharp(original);
    const metadata = await image.metadata();
    const width = metadata.width ?? 800;
    const height = metadata.height ?? 1200;
    const label = `${userId.slice(0, 8)} - ${new Date().toISOString()}`;

    const svg = this.buildWatermarkSvg(width, height, label);
    return image
      .composite([{ input: Buffer.from(svg), blend: "over" }])
      .png()
      .toBuffer();
  }

  private buildWatermarkSvg(width: number, height: number, label: string): string {
    const tileW = 220;
    const tileH = 120;
    const rows = Math.ceil(height / tileH) + 1;
    const cols = Math.ceil(width / tileW) + 1;

    let texts = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileW;
        const y = r * tileH;
        texts += `<text x="${x}" y="${y}" transform="rotate(-30 ${x} ${y})" font-size="14" fill="white" fill-opacity="0.14" font-family="monospace">${escapeXml(label)}</text>`;
      }
    }
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${texts}</svg>`;
  }

  private async reject(assetId: string, userId: string | undefined, ctx: RequestContext, reason: string) {
    await this.repo.logAccess({
      assetId,
      userId: userId ?? "unknown",
      deviceFingerprint: ctx.deviceFingerprint,
      ip: ctx.ip,
      event: "token_rejected",
      reason,
    });
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}
