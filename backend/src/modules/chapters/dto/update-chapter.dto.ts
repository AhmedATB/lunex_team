import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateChapterDto {
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** true = always locked, false = always open, null = automatic (the newest chapters of a series are locked). */
  @IsOptional()
  @IsBoolean()
  manualLock?: boolean | null;

  /** Corrected before (or after) publishing, by anyone who works on the series' chapters. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100000)
  number?: number;
}
