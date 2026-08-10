import { IsString, MinLength } from "class-validator";

export class OAuthCallbackDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
