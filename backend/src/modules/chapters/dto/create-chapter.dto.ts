import { IsNumber, IsOptional, IsString, Length, MaxLength, Min } from "class-validator";

export class CreateChapterDto {
  @IsString()
  @Length(1, 200)
  seriesId!: string;

  /** The publishing team; leave it out (or empty) for a work that has none. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  teamId?: string;

  @IsNumber()
  @Min(0)
  number!: number;

  @IsString()
  @Length(1, 200)
  title!: string;
}
