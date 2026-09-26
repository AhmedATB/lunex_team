import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TeamActivityModule } from "../team-activity/team-activity.module";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationRepository } from "./collaboration.repository";
import { CollaborationService } from "./collaboration.service";

@Module({
  imports: [CatalogModule, NotificationsModule, TeamActivityModule],
  controllers: [CollaborationController],
  providers: [CollaborationService, CollaborationRepository],
})
export class CollaborationModule {}
