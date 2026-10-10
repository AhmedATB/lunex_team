import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { WalletSettingsService } from "./wallet-settings.service";

/** The lock settings on their own, so the modules that only need to read them (wallet, progress) do not depend on each other. */
@Module({
  imports: [PrismaModule],
  providers: [WalletSettingsService],
  exports: [WalletSettingsService],
})
export class WalletSettingsModule {}
