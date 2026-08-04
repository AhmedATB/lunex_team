import { Module } from "@nestjs/common";
import { ImagesController } from "./images.controller";
import { ImagesRepository } from "./images.repository";
import { ImagesService } from "./images.service";
import { StorageService } from "./storage/local-storage.service";

@Module({
  controllers: [ImagesController],
  providers: [ImagesService, ImagesRepository, StorageService],
})
export class ImagesModule {}
