/** Mirrors backend/src/modules/auth/auth.service.ts's PublicUser — kept manually in sync since the two apps don't share a types package (yet; see the infra doc's monorepo/packages/contracts note for the long-term fix). */
export interface BackendPublicUser {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
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
