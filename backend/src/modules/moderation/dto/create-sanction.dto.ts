import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { SANCTION_TYPES } from "../moderation.util";

export const MAX_SANCTION_HOURS = 24 * 365;

export class CreateSanctionDto {
  @IsIn(SANCTION_TYPES)
  type!: string;

  /** Required and shown to the person: a sanction without a stated reason can't be appealed. */
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  /** Timeout: required. Ban: optional (omitted = permanent). Warning: must be omitted. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SANCTION_HOURS)
  durationHours?: number;
}
