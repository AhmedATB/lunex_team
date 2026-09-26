import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { GLOBAL_ROLES } from "./change-role.dto";

/** Query string of GET /v1/users: the owner's list of every account. */
export class ListUsersQueryDto {
  /** Part of a username, display name or email. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(GLOBAL_ROLES)
  role?: string;

  /** Only accounts that are banned right now. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true" || value === "1")
  @IsBoolean()
  banned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/** Query string of GET /v1/users/search: a name or username to look for. */
export class SearchUsersQueryDto {
  @IsString()
  @MaxLength(61)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
