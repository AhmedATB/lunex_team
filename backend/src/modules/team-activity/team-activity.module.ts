import { Module } from "@nestjs/common";
import { TeamActivityController } from "./team-activity.controller";
import { TeamActivityRepository } from "./team-activity.repository";
import { TeamActivityService } from "./team-activity.service";

@Module({
  controllers: [TeamActivityController],
  providers: [TeamActivityService, TeamActivityRepository],
  exports: [TeamActivityService],
})
export class TeamActivityModule {}
