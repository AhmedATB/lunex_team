import { IsString, Length } from "class-validator";

export class ImportAllChaptersDto {
  @IsString()
  @Length(1, 200)
  seriesExternalId!: string;
}
