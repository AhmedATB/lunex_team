import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { COUNTRIES, NEWS_CATEGORIES, SERIES_STATUSES, SERIES_TYPES, TAG_GROUPS, TEAM_CATEGORIES, TEAM_STATUSES } from "../catalog.util";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const URL_OPTIONS = { protocols: ["http", "https"], require_protocol: true };

export class CreateSeriesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  alternativeTitles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @IsOptional()
  @IsIn(SERIES_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(SERIES_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(COUNTRIES)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  artist?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsIn(["safe", "suggestive", "erotica", "pornographic"])
  contentRating?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  /** Tag slugs (genres and themes). Unknown slugs are rejected rather than silently dropped. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tagSlugs?: string[];
}

export class UpdateSeriesDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleEn?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  alternativeTitles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  synopsis?: string;

  @IsOptional()
  @IsIn(SERIES_TYPES)
  type?: string;

  @IsOptional()
  @IsIn(SERIES_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(COUNTRIES)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  artist?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsIn(["safe", "suggestive", "erotica", "pornographic"])
  contentRating?: string;

  /** Moving a series to another team (or off any team with an empty string) is a global editor's decision. */
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;

  @IsOptional()
  @IsIn(["draft", "approved"])
  state?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tagSlugs?: string[];
}

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nameAr!: string;

  @IsOptional()
  @IsIn(TAG_GROUPS)
  group?: string;
}

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goals?: string;

  @IsOptional()
  @Matches(HEX_COLOR)
  color?: string;

  @IsOptional()
  @IsIn(TEAM_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  discordUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  websiteUrl?: string;

  @IsOptional()
  @IsBoolean()
  recruiting?: boolean;

  /** Username of the account to make leader; the account must exist. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  leaderUsername?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goals?: string;

  @IsOptional()
  @Matches(HEX_COLOR)
  color?: string;

  @IsOptional()
  @IsIn(TEAM_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  discordUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  websiteUrl?: string;

  @IsOptional()
  @IsBoolean()
  recruiting?: boolean;

  /** Global team managers only. */
  @IsOptional()
  @IsIn(TEAM_STATUSES)
  status?: string;

  /** Global team managers only. Empty string clears the leader. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  leaderUsername?: string;
}

const TEAM_MEMBER_ROLES = ["team_leader", "assistant_leader", "team_administrator", "translator", "editor", "proofreader", "qc", "publisher", "uploader", "recruiter", "reviewer"];

export class SetMemberDto {
  @IsIn(TEAM_MEMBER_ROLES)
  role!: string;
}

/** Adds an account to a team straight away, without a recruitment post: the account is named by its username. */
export class AddMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(41) // a leading "@" is allowed and dropped
  username!: string;

  @IsIn(TEAM_MEMBER_ROLES)
  role!: string;
}

/** Moves series to a team, or off every team when `teamId` is empty. */
export class TransferSeriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  seriesIds!: string[];

  @IsString()
  @MaxLength(100)
  teamId!: string;
}

export class CreateNewsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsIn(NEWS_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateNewsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsIn(NEWS_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/** The works pinned to the top of the home page, in order; the first is the lead. An empty list unpins everything. */
export class SetFeaturedDto {
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  seriesIds!: string[];
}
