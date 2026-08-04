import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";

const JwtAsyncModule = JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    signOptions: { expiresIn: "10m" },
  }),
});

@Module({
  imports: [JwtAsyncModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  // Re-exporting JwtModule (not just AuthService) is required here: the
  // global JwtAuthGuard is provided at AppModule's own level via APP_GUARD,
  // so JwtService must be visible in AppModule's DI context too — Nest only
  // resolves a module's own providers plus what its imports explicitly
  // export, not transitively through AuthService.
  exports: [AuthService, JwtAsyncModule],
})
export class AuthModule {}
