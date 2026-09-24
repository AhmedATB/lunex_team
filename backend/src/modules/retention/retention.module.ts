import { Module } from "@nestjs/common";
import { RetentionService } from "./retention.service";

/** PrismaModule and ConfigModule are both @Global, so nothing needs importing here. */
@Module({
  providers: [RetentionService],
})
export class RetentionModule {}
