import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

/** Multipart form fields arrive as strings — @Type(() => Number) coerces before validation, same as the global ValidationPipe's transform:true expects. */
export class UploadPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNumber!: number;
}
