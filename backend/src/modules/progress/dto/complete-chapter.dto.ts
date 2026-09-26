import { IsString, MaxLength, MinLength } from "class-validator";

export class CompleteChapterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  chapterId!: string;
}
