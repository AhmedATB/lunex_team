import { IsInt, IsOptional, Max, Min } from "class-validator";

/** Any of the lock settings; the ones left out stay as they are. The limits match `WALLET_LIMITS`. */
export class UpdateWalletSettingsDto {
  /** How many of a series' newest chapters are locked. 0 turns the lock off. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  lockedWindow?: number;

  /** A series' first chapters that are always free. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  freeFirstChapters?: number;

  /** Finished chapters that earn one unlock credit. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  chaptersPerCredit?: number;

  /** Coins it costs to open one locked chapter. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  coinPrice?: number;
}
