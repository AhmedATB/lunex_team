import { IsBoolean } from "class-validator";

export class SetBannedDto {
  @IsBoolean()
  isBanned!: boolean;
}
