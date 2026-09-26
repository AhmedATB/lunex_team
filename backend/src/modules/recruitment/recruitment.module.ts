import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RecruitmentController } from "./recruitment.controller";
import { RecruitmentRepository } from "./recruitment.repository";
import { RecruitmentService } from "./recruitment.service";

@Module({
  imports: [CatalogModule, NotificationsModule],
  controllers: [RecruitmentController],
  providers: [RecruitmentService, RecruitmentRepository],
})
export class RecruitmentModule {}
