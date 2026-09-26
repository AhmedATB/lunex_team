import { IsBoolean, IsOptional } from "class-validator";

export class UpdateChapterDto {
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** true = always locked, false = always open, null = automatic (the newest chapters of a series are locked). */
  @IsOptional()
  @IsBoolean()
  manualLock?: boolean | null;
}
