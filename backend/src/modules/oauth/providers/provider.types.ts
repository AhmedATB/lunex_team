export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  /** Raw handle from the provider — not guaranteed unique or charset-safe; oauth.service.ts sanitizes it before ever touching User.username. */
  suggestedUsername: string;
}

export interface OAuthProviderAdapter {
  getAuthorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<string>; // -> provider access token
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}
