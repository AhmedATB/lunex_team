import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { StorageService } from "./storage.interface";

/**
 * Production object-store backend (Cloudflare R2, S3-compatible) — the
 * real fix for chapter-page bytes living in Postgres (architecture doc
 * §19/§22: "real scale needs S3/R2, not a DB column").
 *
 * Reads config leniently (`config.get`, not `getOrThrow`) rather than
 * validating in the constructor: images.module.ts's factory injects every
 * StorageService implementation to select one, so Nest eagerly constructs
 * this class on every boot regardless of which backend IMAGE_STORAGE_BACKEND
 * actually picks — true for local dev (no R2 credentials at all) and for any
 * prod deploy before the R2_* Railway vars are set. A throwing constructor
 * here would crash the whole backend's boot, not just image serving.
 */
@Injectable()
export class R2StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string | undefined;

  constructor(config: ConfigService) {
    const accountId = config.get<string>("R2_ACCOUNT_ID") ?? "";
    this.bucket = config.get<string>("R2_BUCKET_NAME");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get<string>("R2_ACCESS_KEY_ID") ?? "",
        secretAccessKey: config.get<string>("R2_SECRET_ACCESS_KEY") ?? "",
      },
    });
  }

  private assertConfigured(): string {
    if (!this.bucket) {
      throw new InternalServerErrorException({
        code: "r2_not_configured",
        message: "R2_BUCKET_NAME (and the other R2_* vars) must be set when IMAGE_STORAGE_BACKEND=r2.",
      });
    }
    return this.bucket;
  }

  async get(key: string): Promise<Buffer> {
    const bucket = this.assertConfigured();
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await result.Body!.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      if (err instanceof NoSuchKey) {
        throw new NotFoundException({ code: "asset_not_found", message: "Image asset not found." });
      }
      throw err;
    }
  }

  async put(key: string, data: Buffer): Promise<{ checksum: string }> {
    const bucket = this.assertConfigured();
    const checksum = createHash("sha256").update(data).digest("hex");
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data }));
    return { checksum };
  }
}
