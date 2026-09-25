import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsString, MaxLength, MinLength } from "class-validator";

export const PROFILE_PARTS = ["avatar", "bio", "displayName"] as const;
export type ProfilePart = (typeof PROFILE_PARTS)[number];

export class ResetProfileDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(PROFILE_PARTS, { each: true })
  parts!: ProfilePart[];

  /** Shown to the person, like every staff action's reason. */
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RemoveCommentsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
