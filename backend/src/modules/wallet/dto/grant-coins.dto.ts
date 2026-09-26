import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class GrantCoinsDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,24}$/, { message: "username must be 3-24 letters, numbers or underscores" })
  username!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  amount!: number;

  /** What the coins were for (a payment reference, say) — shown in the ledger. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
