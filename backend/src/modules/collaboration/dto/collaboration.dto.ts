import { IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from "class-validator";

export const COLLABORATION_TYPES = [
  "need_translator",
  "need_editor",
  "need_proofreader",
  "need_qc",
  "need_publisher",
  "need_complete_team_support",
  "emergency_assistance",
] as const;

/** What the asked team can answer (a request starts as pending). */
export const RESPONSES = ["accepted", "rejected", "negotiating"] as const;

export class CreateCollaborationDto {
  @IsString()
  @Length(1, 100)
  fromTeamId!: string;

  @IsString()
  @Length(1, 100)
  toTeamId!: string;

  @IsString()
  @Length(1, 100)
  seriesId!: string;

  @IsIn(COLLABORATION_TYPES)
  type!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  message!: string;
}

export class RespondCollaborationDto {
  @IsIn(RESPONSES)
  status!: string;

  /** Shown to the asking team in the notification. */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;
}
