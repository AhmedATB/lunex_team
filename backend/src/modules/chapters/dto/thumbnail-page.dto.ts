import { IsInt, Min } from "class-validator";

/** Which of the chapter's own pages the featured picture is taken from. */
export class ThumbnailPageDto {
  @IsInt()
  @Min(1)
  pageNumber!: number;
}
