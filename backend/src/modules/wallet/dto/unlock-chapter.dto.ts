import { IsIn } from "class-validator";

export class UnlockChapterDto {
  /** "credit" spends a reading credit; "coins" pays the chapter's price. */
  @IsIn(["credit", "coins"])
  method!: "credit" | "coins";
}
