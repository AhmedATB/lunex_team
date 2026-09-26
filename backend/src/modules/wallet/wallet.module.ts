import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminWalletController, WalletController } from "./wallet.controller";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [WalletController, AdminWalletController],
  providers: [WalletRepository, WalletService],
  exports: [WalletService],
})
export class WalletModule {}
