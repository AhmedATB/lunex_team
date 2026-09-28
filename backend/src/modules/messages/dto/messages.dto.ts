import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

/** Up to this many people besides the one starting the chat. */
export const MAX_OTHER_MEMBERS = 19;
export const MAX_MESSAGE_LENGTH = 2000;
/** Pictures that can go with one message. */
export const MAX_MESSAGE_IMAGES = 10;

/**
 * Starts a chat with the people named by id or by username: one person makes (or finds) the direct chat with them, two or
 * more make a group, which may have a title.
 */
export class CreateConversationDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_OTHER_MEMBERS)
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_OTHER_MEMBERS)
  @IsString({ each: true })
  @MaxLength(41, { each: true })
  usernames?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;
}

export class SendMessageDto {
  /** May be missing or empty when pictures go with the message (the service checks there are words or pictures). */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  text?: string;

  /** Pictures uploaded to `POST /v1/attachments` for this message, in the order to show them. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MESSAGE_IMAGES)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  imageIds?: string[];
}

export class ListMessagesQueryDto {
  /** ISO time of the oldest message already shown; the ones before it are returned. */
  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AddMembersDto {
  @IsArray()
  @ArrayMaxSize(MAX_OTHER_MEMBERS)
  @IsString({ each: true })
  @MaxLength(41, { each: true })
  usernames!: string[];
}
