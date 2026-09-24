import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Deleting an account is irreversible, so a valid session alone isn't enough
 * (same reasoning as ChangePasswordDto). Which field applies depends on how
 * the account signs in — see UsersService.deleteAccount: `password` for an
 * account that has one, `confirmUsername` for a Discord/Google-only account
 * that has no password to type.
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  confirmUsername?: string;
}
