import { IsBoolean, IsOptional } from "class-validator";

export class UpdateChapterDto {
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
