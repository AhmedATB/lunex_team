import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";
import { BotUserAgentGuard } from "./common/security/bot-user-agent.guard";
import { ProofOfWorkGuard } from "./common/security/proof-of-work.guard";
import { SecurityModule } from "./common/security/security.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ChaptersModule } from "./modules/chapters/chapters.module";
import { ImagesModule } from "./modules/images/images.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OAuthModule } from "./modules/oauth/oauth.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default limiter — per-route overrides (login/register/refresh) are
    // stricter, set via @Throttle() in AuthController. This is app-tier
    // rate limiting only; production sits behind CDN/WAF-level limiting
    // too (architecture doc §14/15) as an earlier, cheaper layer.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    SecurityModule,
    PrismaModule,
    AuthModule,
    ChaptersModule,
    ImagesModule,
    NotificationsModule,
    OAuthModule,
    UsersModule,
  ],
  providers: [
    // Global guard order (Nest runs multiple APP_GUARD providers in
    // registration order): cheapest/broadest rejection first.
    //   1. BotUserAgentGuard — free header check, filters obvious scripted clients.
    //   2. JwtAuthGuard — auth by default (opt out per-route with @Public()).
    //   3. ThrottlerGuard — per-IP request-rate ceiling.
    //   4. ProofOfWorkGuard — opt-in (@RequirePow()) CPU-cost gate on abuse-prone endpoints.
    { provide: APP_GUARD, useClass: BotUserAgentGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ProofOfWorkGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
