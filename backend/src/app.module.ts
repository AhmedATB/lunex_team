import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default limiter — per-route overrides (login/register/refresh) are
    // stricter, set via @Throttle() in AuthController. This is app-tier
    // rate limiting only; production sits behind CDN/WAF-level limiting
    // too (architecture doc §14/15) as an earlier, cheaper layer.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
  ],
  providers: [
    // Auth by default (opt out per-route with @Public()) — see JwtAuthGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
