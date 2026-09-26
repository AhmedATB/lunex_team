import { IsString, MaxLength, MinLength } from "class-validator";

/** A Google Drive folder link (or its id) holding the chapter's page images. */
export class ImportDriveDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  link!: string;
}
