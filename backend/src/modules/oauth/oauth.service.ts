import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AuthService, type AuthResponse } from "../auth/auth.service";
import { OAuthRepository } from "./oauth.repository";
import { DiscordProvider } from "./providers/discord.provider";
import { GoogleProvider } from "./providers/google.provider";
import type { OAuthProviderAdapter } from "./providers/provider.types";
import type { RequestContext } from "../../common/middleware/request-context.middleware";

export type OAuthProviderId = "discord" | "google";

/**
 * Every provider secret (Discord/Google client secret) lives only in this
 * module's dependencies (the provider adapters, reading backend env vars) —
 * the token exchange happens server-to-server here and never touches the
 * frontend or the browser. The Next.js BFF only ever sees the final
 * {accessToken, refreshToken, user} this returns, identical in shape to
 * password login/register.
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly repo: OAuthRepository,
    private readonly authService: AuthService,
    private readonly discord: DiscordProvider,
    private readonly google: GoogleProvider
  ) {}

  private adapterFor(provider: OAuthProviderId): OAuthProviderAdapter {
    return provider === "discord" ? this.discord : this.google;
  }

  startAuthorize(provider: OAuthProviderId, redirectUri: string): { url: string; state: string } {
    const state = randomBytes(24).toString("base64url");
    const url = this.adapterFor(provider).getAuthorizeUrl(state, redirectUri);
    return { url, state };
  }

  async handleCallback(
    provider: OAuthProviderId,
    code: string,
    redirectUri: string,
    ctx: RequestContext
  ): Promise<AuthResponse> {
    const adapter = this.adapterFor(provider);
    const accessToken = await adapter.exchangeCode(code, redirectUri);
    const profile = await adapter.fetchProfile(accessToken);

    const existingLink = await this.repo.findAccount(provider, profile.providerAccountId);
    if (existingLink) {
      await this.repo.writeAuditLog({ actorId: existingLink.userId, action: `oauth.${provider}.login`, ip: ctx.ip });
      const tokens = await this.authService.issueSessionForUser(existingLink.user.id, existingLink.user.role, ctx);
      return { ...tokens, user: this.authService.toPublicUserFrom(existingLink.user) };
    }

    // No link yet — try to attach this provider to an existing account with
    // the same, provider-verified email. Only when the provider itself
    // vouches the email is verified: an unverified email is not proof of
    // ownership, and auto-linking on it would let anyone claim someone
    // else's account just by typing their email into a throwaway OAuth app.
    let user = profile.emailVerified ? await this.repo.findUserByEmail(profile.email) : null;

    if (!user) {
      const username = await this.generateUniqueUsername(profile.suggestedUsername);
      user = await this.repo.createUserFromOAuth(profile.email, username);
      await this.repo.writeAuditLog({ actorId: user.id, action: "user.register_oauth", target: provider, ip: ctx.ip });
    }

    await this.repo.linkAccount(user.id, provider, profile.providerAccountId);
    await this.repo.writeAuditLog({ actorId: user.id, action: `oauth.${provider}.link`, ip: ctx.ip });

    const tokens = await this.authService.issueSessionForUser(user.id, user.role, ctx);
    return { ...tokens, user: this.authService.toPublicUserFrom(user) };
  }

  private async generateUniqueUsername(raw: string): Promise<string> {
    let base = raw.replace(/[^a-zA-Z0-9_]/g, "");
    if (base.length < 3) base = `user${randomBytes(2).toString("hex")}`;
    base = base.slice(0, 20);

    let candidate = base;
    let attempt = 0;
    while (await this.repo.findUserByUsername(candidate)) {
      attempt += 1;
      candidate = `${base}_${randomBytes(2).toString("hex")}`;
      if (attempt > 10) break; // give up gracefully on pathological collision runs rather than loop forever
    }
    return candidate;
  }
}
