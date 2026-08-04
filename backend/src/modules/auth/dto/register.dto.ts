import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

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
