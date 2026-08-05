import { IsIn } from "class-validator";

export const GLOBAL_ROLES = [
  "guest",
  "reader",
  "verified_member",
  "uploader",
  "moderator",
  "support",
  "news_manager",
  "editor",
  "global_team_manager",
  "super_administrator",
  "owner",
] as const;

export class ChangeRoleDto {
  @IsIn(GLOBAL_ROLES)
  role!: string;
}
