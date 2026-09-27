import { IsNumber, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SavePositionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  chapterId!: string;

  /** 0 at the top, 1 at the end. */
  @IsNumber()
  @Min(0)
  @Max(1)
  fraction!: number;
}
