import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { AuthRepository } from "./auth.repository";
import { getDummyHash, hashPassword, verifyPassword } from "./crypto/password.util";
import type { RequestContext } from "../../common/middleware/request-context.middleware";

const ACCESS_TOKEN_TTL = "10m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Orchestration only — every DB call goes through AuthRepository, every
 * password op through crypto/password.util. This is what "service layer"
 * means in the architecture doc: this file should stay readable as a story
 * of business rules, not a pile of query builders.
 */
@Injectable()
export class AuthService {
  private readonly refreshPepper: string;

  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {
    this.refreshPepper = this.config.getOrThrow<string>("JWT_REFRESH_PEPPER");
  }

  async register(email: string, password: string, ctx: RequestContext) {
    const existing = await this.repo.findUserByEmail(email);
    if (existing) {
      // Generic message — do not reveal that the email is already taken via
      // a different error than "check your input", or registration becomes
      // an account-enumeration oracle.
      throw new ConflictException({ code: "registration_failed", message: "Unable to complete registration." });
    }

    const passwordHash = await hashPassword(password);
    const user = await this.repo.createUser(email, passwordHash);
    await this.repo.writeAuditLog({ actorId: user.id, action: "user.register", ip: ctx.ip });

    return this.issueSession(user.id, user.role, ctx);
  }

  async login(email: string, password: string, ctx: RequestContext): Promise<SessionTokens> {
    const user = await this.repo.findUserByEmail(email);

    // Always verify against SOME Argon2id hash, even for an unknown email —
    // otherwise a missing-user response returns near-instantly while a
    // wrong-password response takes ~100ms, and that timing gap alone lets
    // an attacker enumerate valid emails without ever seeing an error
    // message say so.
    const hashToCheck = user?.passwordHash ?? (await getDummyHash());
    const passwordOk = await verifyPassword(hashToCheck, password);

    if (!user || !passwordOk) {
      await this.repo.recordLoginEvent({ email, ip: ctx.ip, outcome: "invalid_credentials" });
      throw new UnauthorizedException({ code: "invalid_credentials", message: "Incorrect email or password." });
    }

    await this.repo.recordLoginEvent({ userId: user.id, email, ip: ctx.ip, outcome: "success" });
    return this.issueSession(user.id, user.role, ctx);
  }

  /**
   * Refresh-token rotation with reuse detection: every refresh consumes the
   * old token and issues a new one. If an already-consumed (revoked) token
   * is presented again, that's exactly the signature of an attacker
   * replaying a stolen token after the legitimate user already rotated past
   * it — so the whole session family is killed, not just this one token.
   */
  async refresh(rawRefreshToken: string, ctx: RequestContext): Promise<SessionTokens> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const session = await this.repo.findSessionByRefreshHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException({ code: "invalid_refresh_token", message: "Session not found." });
    }
    if (session.revoked) {
      await this.repo.revokeSessionFamily(session.familyId);
      await this.repo.writeAuditLog({
        actorId: session.userId,
        action: "session.reuse_detected",
        ip: ctx.ip,
      });
      throw new UnauthorizedException({ code: "session_reuse_detected", message: "Session revoked for security." });
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: "refresh_token_expired", message: "Please log in again." });
    }

    await this.repo.revokeSession(session.id);
    const user = await this.repo.findUserById(session.userId);
    if (!user) {
      throw new UnauthorizedException({ code: "user_not_found", message: "Account no longer exists." });
    }

    return this.issueSession(user.id, user.role, ctx, session.familyId);
  }

  private async issueSession(
    userId: string,
    role: string,
    ctx: RequestContext,
    familyId: string = randomUUID()
  ): Promise<SessionTokens> {
    const device = await this.repo.upsertDevice(userId, ctx.deviceFingerprint);

    const rawRefreshToken = randomBytes(32).toString("base64url");
    const refreshTokenHash = this.hashRefreshToken(rawRefreshToken);

    await this.repo.createSession({
      userId,
      deviceId: device.id,
      familyId,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, role },
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: 10 * 60 };
  }

  /**
   * Refresh tokens are already 256 bits of CSPRNG output — unlike passwords
   * they don't need a slow, memory-hard hash to resist brute force. HMAC
   * with a server-side pepper is the right tool here: fast (session lookups
   * shouldn't cost 100ms+) but still means a raw DB dump alone (without the
   * pepper, which lives only in the app's env/secrets manager) isn't enough
   * to forge a valid session.
   */
  private hashRefreshToken(raw: string): string {
    return createHmac("sha256", this.refreshPepper).update(raw).digest("hex");
  }
}
