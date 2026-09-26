import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  /** The random token from the link in the mail (43 characters as issued; the bounds only keep junk out). */
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  /** Same length rule as RegisterDto.password. */
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  password!: string;
}
