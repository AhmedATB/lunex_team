import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/// @Global — every module needs DB access and re-importing PrismaModule
/// everywhere would just be ceremony; the repository pattern (one repository
/// per module, PrismaService injected only there) is what actually keeps
/// query logic contained, not module-import scoping.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
