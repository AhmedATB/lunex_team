import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { StorageService } from "./storage.interface";

/**
 * Local filesystem — dev-only. Railway's disk is wiped on every deploy
 * (architecture doc §16), so this must never back real chapter images in
 * production; PrismaBlobStorageService is the current production default
 * until a real object store (S3/R2) exists. Kept because it's still the
 * easiest way to run/verify the image pipeline with zero external infra.
 */
@Injectable()
export class LocalDiskStorageService implements StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>("IMAGE_STORAGE_DIR") ?? "./storage/images");
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch {
      throw new NotFoundException({ code: "asset_not_found", message: "Image asset not found." });
    }
  }

  async put(key: string, data: Buffer): Promise<{ checksum: string }> {
    const path = this.resolveKey(key);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, data);
    return { checksum: createHash("sha256").update(data).digest("hex") };
  }

  /** Rejects any key that would traverse outside the storage root (../, absolute paths) — storageKey values ultimately trace back to DB rows, but this is the layer that must never trust that alone. */
  private resolveKey(key: string): string {
    const resolved = resolve(this.root, normalize(key));
    if (resolved !== this.root && !resolved.startsWith(this.root + sep)) {
      throw new NotFoundException({ code: "asset_not_found", message: "Image asset not found." });
    }
    return resolved;
  }
}
