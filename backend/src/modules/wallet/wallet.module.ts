import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WalletSettingsModule } from "./wallet-settings.module";
import { AdminWalletController, PublicWalletController, WalletController } from "./wallet.controller";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

@Module({
  imports: [PrismaModule, NotificationsModule, WalletSettingsModule],
  controllers: [WalletController, PublicWalletController, AdminWalletController],
  providers: [WalletRepository, WalletService],
  exports: [WalletService],
})
export class WalletModule {}
