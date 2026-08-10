import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OAuthProfile, OAuthProviderAdapter } from "./provider.types";

interface DiscordTokenResponse {
  access_token: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
}

@Injectable()
export class DiscordProvider implements OAuthProviderAdapter {
  constructor(private readonly config: ConfigService) {}

  getAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>("DISCORD_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify email",
      state,
      prompt: "consent",
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const res = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow<string>("DISCORD_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("DISCORD_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      throw new UnauthorizedException({ code: "oauth_exchange_failed", message: "Discord rejected the authorization code." });
    }
    const body = (await res.json()) as DiscordTokenResponse;
    return body.access_token;
  }

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const res = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new UnauthorizedException({ code: "oauth_profile_failed", message: "Could not read the Discord profile." });
    }
    const body = (await res.json()) as DiscordUserResponse;
    if (!body.email) {
      // The `email` scope was granted but Discord still can't always return
      // one (e.g. no verified email on the account) — we require it, since
      // email is how OAuth accounts link to existing password accounts.
      throw new UnauthorizedException({
        code: "oauth_email_required",
        message: "Your Discord account has no email address LUNEX TEAM can use.",
      });
    }
    return {
      providerAccountId: body.id,
      email: body.email,
      emailVerified: body.verified,
      suggestedUsername: body.username,
    };
  }
}
