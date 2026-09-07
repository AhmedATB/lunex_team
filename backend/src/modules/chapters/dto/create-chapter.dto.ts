import { IsNumber, IsString, Length, Min } from "class-validator";

export class CreateChapterDto {
  @IsString()
  @Length(1, 200)
  seriesId!: string;

  @IsString()
  @Length(1, 200)
  teamId!: string;

  @IsNumber()
  @Min(0)
  number!: number;

  @IsString()
  @Length(1, 200)
  title!: string;
}
