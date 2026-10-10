import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { WalletSettingsModule } from "../wallet/wallet-settings.module";
import { ProgressController } from "./progress.controller";
import { ProgressRepository } from "./progress.repository";
import { ProgressService } from "./progress.service";

@Module({
  imports: [PrismaModule, WalletSettingsModule],
  controllers: [ProgressController],
  providers: [ProgressRepository, ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
