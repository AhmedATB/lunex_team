import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "../notification-text";

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: NotificationCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** ISO time of the oldest notification already shown; the page after it is returned. */
  @IsOptional()
  @IsDateString()
  before?: string;
}

export class MarkAllReadDto {
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: NotificationCategory;
}
