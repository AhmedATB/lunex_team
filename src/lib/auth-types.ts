import type { ProfileVisibility } from "@/lib/profile-types";

/** Mirrors backend/src/modules/auth/auth.service.ts's PublicUser — kept manually in sync since the two apps don't share a types package (yet; see the infra doc's monorepo/packages/contracts note for the long-term fix). */
export interface BackendPublicUser {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
  displayName: string | null;
  bio: string | null;
  /** Set only when a real uploaded avatar exists — see resolveAvatarUrl in lib/utils. */
  avatarVersion: string | null;
  isBanned: boolean;
  /** ISO end of a running timeout (cannot comment or message), else null. */
  mutedUntil: string | null;
  /** false for a Discord/Google-only account (no password to type). */
  hasPassword: boolean;
  /** Who may open each part of the profile — see lib/profile-types. */
  profileVisibility: ProfileVisibility;
  historyVisibility: ProfileVisibility;
  favoritesVisibility: ProfileVisibility;
}

export interface BackendAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: BackendPublicUser;
}

export interface BackendErrorBody {
  statusCode: number;
  code: string;
  message: string;
}
