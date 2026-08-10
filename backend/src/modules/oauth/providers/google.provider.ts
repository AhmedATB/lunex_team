import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OAuthProfile, OAuthProviderAdapter } from "./provider.types";

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserInfoResponse {
  sub: string;
  email: string | null;
  email_verified: boolean;
  name: string | null;
}

@Injectable()
export class GoogleProvider implements OAuthProviderAdapter {
  constructor(private readonly config: ConfigService) {}

  getAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>("GOOGLE_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow<string>("GOOGLE_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("GOOGLE_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      throw new UnauthorizedException({ code: "oauth_exchange_failed", message: "Google rejected the authorization code." });
    }
    const body = (await res.json()) as GoogleTokenResponse;
    return body.access_token;
  }

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new UnauthorizedException({ code: "oauth_profile_failed", message: "Could not read the Google profile." });
    }
    const body = (await res.json()) as GoogleUserInfoResponse;
    if (!body.email) {
      throw new UnauthorizedException({
        code: "oauth_email_required",
        message: "Your Google account has no email address LUNEX TEAM can use.",
      });
    }
    return {
      providerAccountId: body.sub,
      email: body.email,
      emailVerified: body.email_verified,
      suggestedUsername: body.name ?? body.email.split("@")[0],
    };
  }
}
