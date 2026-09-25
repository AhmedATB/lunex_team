import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export const MAX_COMMENT_LENGTH = 2000;
export const REACTION_KINDS = ["like", "dislike", "none"] as const;

/** Same shape the profile library uses for `seriesId` — a plain id, never a path or URL. */
export const SERIES_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class CreateCommentDto {
  @Matches(SERIES_ID_PATTERN, { message: "seriesId is not valid" })
  seriesId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_LENGTH * 2) // generous here; the service trims and enforces the real limit on the cleaned text
  content!: string;

  @IsOptional()
  @IsBoolean()
  isSpoiler?: boolean;
}

/** Which field may be changed depends on who is asking — CommentsService decides. */
export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_LENGTH * 2)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isSpoiler?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class ReactDto {
  @IsIn(REACTION_KINDS)
  kind!: string;
}

export class ReportCommentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
