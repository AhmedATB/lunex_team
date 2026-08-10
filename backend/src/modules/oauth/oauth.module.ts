import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OAuthController } from "./oauth.controller";
import { OAuthRepository } from "./oauth.repository";
import { OAuthService } from "./oauth.service";
import { DiscordProvider } from "./providers/discord.provider";
import { GoogleProvider } from "./providers/google.provider";

@Module({
  imports: [AuthModule],
  controllers: [OAuthController],
  providers: [OAuthService, OAuthRepository, DiscordProvider, GoogleProvider],
})
export class OAuthModule {}
