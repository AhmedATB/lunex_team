import { IsInt, Min } from "class-validator";

/** Two page numbers of the same chapter whose pictures change places. */
export class SwapPagesDto {
  @IsInt()
  @Min(1)
  a!: number;

  @IsInt()
  @Min(1)
  b!: number;
}
