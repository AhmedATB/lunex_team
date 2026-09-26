import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TeamRequestsController } from "./team-requests.controller";
import { TeamRequestsRepository } from "./team-requests.repository";
import { TeamRequestsService } from "./team-requests.service";

@Module({
  imports: [CatalogModule, NotificationsModule],
  controllers: [TeamRequestsController],
  providers: [TeamRequestsService, TeamRequestsRepository],
})
export class TeamRequestsModule {}
