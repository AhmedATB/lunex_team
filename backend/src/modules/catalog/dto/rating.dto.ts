import { IsInt, Max, Min } from "class-validator";

export class SetRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;
}
