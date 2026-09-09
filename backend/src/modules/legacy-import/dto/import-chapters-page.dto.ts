import { IsString, Length } from "class-validator";
import { ImportPageDto } from "./import-page.dto";

export class ImportChaptersPageDto extends ImportPageDto {
  @IsString()
  @Length(1, 200)
  seriesExternalId!: string;
}
