import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";
import { BotUserAgentGuard } from "./common/security/bot-user-agent.guard";
import { ClientIpThrottlerGuard } from "./common/security/client-ip-throttler.guard";
import { ProofOfWorkGuard } from "./common/security/proof-of-work.guard";
import { SecurityModule } from "./common/security/security.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BotIntegrationModule } from "./modules/bot-integration/bot-integration.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { ChaptersModule } from "./modules/chapters/chapters.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { HealthModule } from "./modules/health/health.module";
import { ImagesModule } from "./modules/images/images.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { ModerationModule } from "./modules/moderation/moderation.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OAuthModule } from "./modules/oauth/oauth.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { ProgressModule } from "./modules/progress/progress.module";
import { RetentionModule } from "./modules/retention/retention.module";
import { UsersModule } from "./modules/users/users.module";
import { WalletModule } from "./modules/wallet/wallet.module";
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
    BotIntegrationModule,
    CatalogModule,
    ChaptersModule,
    CommentsModule,
    HealthModule,
    ImagesModule,
    MessagesModule,
    ModerationModule,
    NotificationsModule,
    OAuthModule,
    ProfilesModule,
    ProgressModule,
    RetentionModule,
    UsersModule,
    WalletModule,
  ],
  providers: [
    // Global guard order (Nest runs multiple APP_GUARD providers in
    // registration order): cheapest/broadest rejection first.
    //   1. BotUserAgentGuard — free header check, filters obvious scripted clients.
    //   2. JwtAuthGuard — auth by default (opt out per-route with @Public()).
    //   3. ClientIpThrottlerGuard — per-visitor request-rate ceiling (per verified client IP; see the guard).
    //   4. ProofOfWorkGuard — opt-in (@RequirePow()) CPU-cost gate on abuse-prone endpoints.
    { provide: APP_GUARD, useClass: BotUserAgentGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    { provide: APP_GUARD, useClass: ProofOfWorkGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
