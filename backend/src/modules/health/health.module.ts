import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

/** PrismaModule is @Global, so nothing needs importing here. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
