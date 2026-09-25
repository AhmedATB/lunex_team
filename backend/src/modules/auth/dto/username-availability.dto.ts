import { IsString, MaxLength } from "class-validator";

export class UsernameAvailabilityDto {
  /** Not pattern-checked here: a name that cannot be valid is answered with reason "invalid", which the sign-up form shows. */
  @IsString()
  @MaxLength(64)
  username!: string;
}
