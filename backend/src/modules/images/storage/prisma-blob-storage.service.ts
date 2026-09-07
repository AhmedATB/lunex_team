import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageService } from "./storage.interface";

/**
 * Current production default: no S3/R2 account exists yet, and Railway's
 * local disk is wiped on every deploy, so real chapter-image bytes go into
 * Postgres for now (same pattern already used for avatars) — see
 * architecture doc §16/§19. This is explicitly an interim measure, not a
 * scaling plan: swap to an S3/R2-backed StorageService when that's set up,
 * which touches only this file and images.module.ts's provider binding.
 */
@Injectable()
export class PrismaBlobStorageService implements StorageService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<Buffer> {
    const row = await this.prisma.imageBlob.findUnique({ where: { storageKey: key } });
    if (!row) {
      throw new NotFoundException({ code: "asset_not_found", message: "Image asset not found." });
    }
    return Buffer.from(row.data);
  }

  async put(key: string, data: Buffer): Promise<{ checksum: string }> {
    await this.prisma.imageBlob.create({ data: { storageKey: key, data } });
    return { checksum: createHash("sha256").update(data).digest("hex") };
  }
}
