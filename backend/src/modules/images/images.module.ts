import { Module } from "@nestjs/common";
import { ImagesController } from "./images.controller";
import { ImagesRepository } from "./images.repository";
import { ImagesService } from "./images.service";
import { LocalDiskStorageService } from "./storage/local-storage.service";
import { PrismaBlobStorageService } from "./storage/prisma-blob-storage.service";
import { StorageService } from "./storage/storage.interface";

/**
 * IMAGE_STORAGE_BACKEND=local opts into the dev-only local-disk backend
 * (useful for running the pipeline with zero DB writes); any other value,
 * including unset, uses the Postgres-backed default — see
 * PrismaBlobStorageService for why that's the current production choice.
 */
@Module({
  controllers: [ImagesController],
  providers: [
    ImagesService,
    ImagesRepository,
    LocalDiskStorageService,
    PrismaBlobStorageService,
    {
      provide: StorageService,
      useFactory: (local: LocalDiskStorageService, prismaBlob: PrismaBlobStorageService) =>
        process.env.IMAGE_STORAGE_BACKEND === "local" ? local : prismaBlob,
      inject: [LocalDiskStorageService, PrismaBlobStorageService],
    },
  ],
  // ChaptersModule stores page bytes through the same StorageService rather
  // than standing up a second storage config, and calls ImagesService to
  // mint tokens once IT has decided the caller is authorized — ImagesService
  // itself stays authorization-agnostic (token mechanics only).
  exports: [StorageService, ImagesService],
})
export class ImagesModule {}
