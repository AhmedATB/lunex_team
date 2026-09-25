import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, DISPLAY_NAME_PATTERN, normalizeDisplayName } from "../../users/username.util";

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: "username may only contain letters, numbers, and underscores" })
  username!: string;

  /**
   * The name shown to other readers, separate from the handle above: any script (Arabic included), not unique.
   * Optional on the API so older clients keep working; the sign-up form always sends it, and an account without one
   * simply shows its username.
   */
  @IsOptional()
  @Transform(({ value }) => normalizeDisplayName(value))
  @IsString()
  @MinLength(DISPLAY_NAME_MIN)
  @MaxLength(DISPLAY_NAME_MAX)
  @Matches(DISPLAY_NAME_PATTERN, { message: "displayName may only contain letters, numbers, spaces, and . _ ' -" })
  displayName?: string;

  /**
   * Length only, deliberately — Argon2id makes brute-forcing expensive
   * regardless of composition rules, and composition rules ("must contain a
   * symbol") are known to push users toward predictable substitutions
   * (NIST SP 800-63B recommends against them). Breach-corpus checking
   * belongs here in production; not included in this first pass.
   */
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  password!: string;
}
