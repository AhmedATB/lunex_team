import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  auth!: string;
}

/** What a browser hands over when it agrees to receive notifications (`PushSubscription.toJSON()`). */
export class SubscribeDto {
  @IsString()
  @MaxLength(1000)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class UnsubscribeDto {
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}

export class PreferencesDto {
  @IsOptional()
  @IsBoolean()
  chapters?: boolean;

  @IsOptional()
  @IsBoolean()
  messages?: boolean;

  @IsOptional()
  @IsBoolean()
  replies?: boolean;

  @IsOptional()
  @IsBoolean()
  news?: boolean;

  @IsOptional()
  @IsBoolean()
  account?: boolean;
}
