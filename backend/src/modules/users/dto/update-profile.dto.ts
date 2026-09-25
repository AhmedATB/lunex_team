import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, DISPLAY_NAME_PATTERN, normalizeDisplayName } from "../username.util";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: "username may only contain letters, numbers, and underscores" })
  username?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDisplayName(value))
  @IsString()
  @MinLength(DISPLAY_NAME_MIN)
  @MaxLength(DISPLAY_NAME_MAX)
  @Matches(DISPLAY_NAME_PATTERN, { message: "displayName may only contain letters, numbers, spaces, and . _ ' -" })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;
}
