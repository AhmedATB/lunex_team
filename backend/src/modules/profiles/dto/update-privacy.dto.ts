import { IsIn, IsOptional } from "class-validator";
import { PROFILE_VISIBILITY_LEVELS } from "../profile-visibility.util";

export class UpdatePrivacyDto {
  @IsOptional()
  @IsIn(PROFILE_VISIBILITY_LEVELS)
  profileVisibility?: string;

  @IsOptional()
  @IsIn(PROFILE_VISIBILITY_LEVELS)
  historyVisibility?: string;

  @IsOptional()
  @IsIn(PROFILE_VISIBILITY_LEVELS)
  favoritesVisibility?: string;
}
