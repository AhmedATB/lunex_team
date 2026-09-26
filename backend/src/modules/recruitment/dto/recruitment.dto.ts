import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

/** The roles a team can open a position for, and a member can be accepted into. */
export const RECRUITABLE_ROLES = ["translator", "editor", "proofreader", "qc", "publisher", "uploader", "recruiter", "reviewer"] as const;
export const DECISIONS = ["accepted", "rejected", "interview", "waitlist"] as const;

export class CreatePositionDto {
  @IsIn(RECRUITABLE_ROLES)
  role!: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;
}

export class SetPositionOpenDto {
  @IsBoolean()
  isOpen!: boolean;
}

export class ApplyDto {
  /** The position applied for; without one the application is a general request to join. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  positionId?: string;

  @IsIn(RECRUITABLE_ROLES)
  preferredRole!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1500)
  experience!: string;

  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(300)
  portfolioUrl?: string;

  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  languages!: string[];

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  availability!: string;
}

export class ReviewApplicationDto {
  @IsIn(DECISIONS)
  status!: string;

  /** The role given when accepting (default: the one applied for). */
  @IsOptional()
  @IsIn(RECRUITABLE_ROLES)
  role?: string;

  /** A note to the applicant. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PositionsQueryDto {
  /** Include closed positions too (team managers only; ignored for anyone else). */
  @IsOptional()
  @Type(() => String)
  @IsIn(["true", "false"])
  all?: string;
}
