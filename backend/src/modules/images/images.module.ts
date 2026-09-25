import { Module } from "@nestjs/common";
import { ImagesController } from "./images.controller";
import { ImagesRepository } from "./images.repository";
import { ImagesService } from "./images.service";
import { LocalDiskStorageService } from "./storage/local-storage.service";
import { PrismaBlobStorageService } from "./storage/prisma-blob-storage.service";
import { R2StorageService } from "./storage/r2-storage.service";
import { StorageService } from "./storage/storage.interface";

/**
 * IMAGE_STORAGE_BACKEND selects the backend: "local" (dev-only disk, zero DB
 * writes), "r2" (Cloudflare R2 — the real production target, see
 * R2StorageService), or anything else/unset (today's Postgres-backed
 * default, kept until the R2 cutover — see PrismaBlobStorageService).
 */
@Module({
  controllers: [ImagesController],
  providers: [
    ImagesService,
    ImagesRepository,
    LocalDiskStorageService,
    PrismaBlobStorageService,
    R2StorageService,
    {
      provide: StorageService,
      useFactory: (local: LocalDiskStorageService, prismaBlob: PrismaBlobStorageService, r2: R2StorageService) => {
        switch (process.env.IMAGE_STORAGE_BACKEND) {
          case "local":
            return local;
          case "r2":
            return r2;
          default:
            return prismaBlob;
        }
      },
      inject: [LocalDiskStorageService, PrismaBlobStorageService, R2StorageService],
    },
  ],
  // ChaptersModule stores page bytes through the same StorageService rather
  // than standing up a second storage config, and calls ImagesService to
  // mint tokens once IT has decided the caller is authorized — ImagesService
  // itself stays authorization-agnostic (token mechanics only).
  // R2StorageService is exported for the owner's "copy existing images to R2" tool (catalog/legacy/storage-admin.service.ts).
  exports: [StorageService, ImagesService, R2StorageService],
})
export class ImagesModule {}
