import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { TEAM_CATEGORIES } from "../../catalog/catalog.util";
import { RECRUITABLE_ROLES } from "../../recruitment/dto/recruitment.dto";

const URL_OPTIONS = { protocols: ["http", "https"], require_protocol: true };

export const REQUEST_STATUSES = ["pending", "needs_modification", "approved", "rejected", "suspended", "archived"] as const;
/** What a manager can put a request into. */
export const DECISIONS = ["approved", "rejected", "needs_modification", "suspended", "archived"] as const;

/** A member's request to open a team (also what they resend after being asked to change it). */
export class TeamRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  teamName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  goals!: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  discordUrl?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RECRUITABLE_ROLES.length)
  @ArrayUnique()
  @IsIn(RECRUITABLE_ROLES, { each: true })
  requiredPositions!: string[];

  @IsIn(TEAM_CATEGORIES)
  category!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  expectedMembers!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  previousExperience?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  portfolioUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  logoUrl?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

export class ReviewTeamRequestDto {
  @IsIn(DECISIONS)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;
}

export class ListTeamRequestsDto {
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: string;
}
