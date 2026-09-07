import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  currentPassword!: string;

  /** Same length rule as RegisterDto.password — see that file for why length-only. */
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword!: string;
}
