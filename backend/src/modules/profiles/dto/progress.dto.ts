import { IsNumber, IsObject, IsOptional, Max, Min, IsArray, ArrayMaxSize, IsString } from "class-validator";

export const MAX_CHAPTER_NUMBER = 100_000;
export const MAX_SYNC_ITEMS = 1000;

export class SetProgressDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_CHAPTER_NUMBER)
  chapterNumber!: number;
}

/**
 * Local (guest or other-device) library merged into the account. The record's
 * keys and values can't be described to class-validator, so ProfilesService
 * validates every entry itself — the caps here only bound the request size.
 */
export class SyncLibraryDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SYNC_ITEMS)
  @IsString({ each: true })
  bookmarks?: string[];

  @IsOptional()
  @IsObject()
  progress?: Record<string, number>;
}
