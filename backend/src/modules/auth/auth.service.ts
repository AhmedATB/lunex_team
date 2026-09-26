import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type User as PrismaUser } from "@prisma/client";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { AuthRepository } from "./auth.repository";
import { getDummyHash, hashPassword, verifyPassword } from "./crypto/password.util";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { activeMutedUntil, isEffectivelyBanned } from "../moderation/moderation.util";
import { isReservedDisplayName, isReservedUsername, USERNAME_PATTERN } from "../users/username.util";
import { PASSWORD_RESET_TTL_MINUTES, passwordResetMail } from "./password-reset.mail";

const ACCESS_TOKEN_TTL = "10m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Asking twice within this window sends one mail: a stuck finger (or someone mail-bombing an inbox) costs nothing. */
const RESET_MAIL_COOLDOWN_MS = 2 * 60 * 1000;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: Date;
  displayName: string | null;
  bio: string | null;
  avatarVersion: string | null;
  /** true only while a ban is in force — a temporary ban that has run out reads false. */
  isBanned: boolean;
  /** ISO end of a running timeout (cannot comment or message), else null. */
  mutedUntil: string | null;
  /** false for a Discord/Google-only account — tells the UI which confirmation an irreversible action needs (password vs. retyping the username). The hash itself never leaves the server. */
  hasPassword: boolean;
  /** Who may open each part of the profile: "public" | "members" | "private". */
  profileVisibility: string;
  historyVisibility: string;
  favoritesVisibility: string;
}

export interface AuthResponse extends SessionTokens {
  user: PublicUser;
}

/**
 * Orchestration only — every DB call goes through AuthRepository, every
 * password op through crypto/password.util. This is what "service layer"
 * means in the architecture doc: this file should stay readable as a story
 * of business rules, not a pile of query builders.
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private readonly refreshPepper: string;

  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService
  ) {
    this.refreshPepper = this.config.getOrThrow<string>("JWT_REFRESH_PEPPER");
  }

  /**
   * Whether a name can be taken. Unlike registration itself this says WHY not — a person choosing a name needs to
   * know — which is fine for usernames (profiles are public by username) and is not done for emails.
   */
  async usernameAvailability(username: string): Promise<{ available: boolean; reason?: "invalid" | "reserved" | "taken" }> {
    if (!USERNAME_PATTERN.test(username)) return { available: false, reason: "invalid" };
    if (isReservedUsername(username)) return { available: false, reason: "reserved" };
    const [exact, lookalike] = await Promise.all([this.repo.findUserByUsername(username), this.repo.findUserByUsernameKey(username)]);
    return exact || lookalike ? { available: false, reason: "taken" } : { available: true };
  }

  async register(email: string, password: string, username: string, displayName: string | undefined, ctx: RequestContext): Promise<AuthResponse> {
    // Said plainly (unlike a taken name): nothing here reveals another account, and the person needs to know to pick another.
    if (displayName && isReservedDisplayName(displayName)) {
      throw new ConflictException({ code: "display_name_reserved", message: "This display name is not available." });
    }

    const [existingEmail, availability] = await Promise.all([this.repo.findUserByEmail(email), this.usernameAvailability(username)]);
    if (existingEmail || !availability.available) {
      // Generic message either way — do not reveal WHICH field collided via
      // a different error, or registration becomes an enumeration oracle
      // for both emails and usernames.
      throw new ConflictException({ code: "registration_failed", message: "Unable to complete registration." });
    }

    const passwordHash = await hashPassword(password);
    let user: PrismaUser;
    try {
      user = await this.repo.createUser(email, username, passwordHash, displayName);
    } catch (err) {
      // Two sign-ups for the same name (or look-alike) at once: the unique index lets one through.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException({ code: "registration_failed", message: "Unable to complete registration." });
      }
      throw err;
    }
    await this.repo.writeAuditLog({ actorId: user.id, action: "user.register", ip: ctx.ip });

    // notifyNewDevice: false — every device is "new" on the very first login
    // right after registering, so alerting about it would just be noise.
    const tokens = await this.issueSession(user.id, user.role, ctx, undefined, false);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async login(email: string, password: string, ctx: RequestContext): Promise<AuthResponse> {
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

    // Checked only after the password is confirmed correct — a wrong-password
    // guess must never reveal whether an account happens to be banned.
    if (isEffectivelyBanned(user)) {
      await this.repo.recordLoginEvent({ userId: user.id, email, ip: ctx.ip, outcome: "banned" });
      throw new ForbiddenException({ code: "account_banned", message: this.bannedMessage(user.bannedUntil) });
    }

    await this.repo.recordLoginEvent({ userId: user.id, email, ip: ctx.ip, outcome: "success" });
    const tokens = await this.issueSession(user.id, user.role, ctx);
    return { ...tokens, user: this.toPublicUser(user) };
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
    // A ban revokes every session up front, but this bounds the case where a
    // refresh was already in flight (or the revoke hasn't landed yet) from
    // still minting a fresh session for a banned account.
    if (isEffectivelyBanned(user)) {
      throw new UnauthorizedException({ code: "account_banned", message: this.bannedMessage(user.bannedUntil) });
    }

    return this.issueSession(user.id, user.role, ctx, session.familyId);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: "user_not_found", message: "Account no longer exists." });
    }
    return this.toPublicUser(user);
  }

  /**
   * Public wrapper around issueSession for OAuthService — OAuth logins get
   * the exact same session/cookie contract as password logins, just via a
   * different identity check upstream. The ban check lives here too: OAuth
   * never goes through login(), so a banned user linking or reusing a
   * Discord/Google account is the one other place a session could be
   * minted for them.
   */
  async issueSessionForUser(userId: string, role: string, ctx: RequestContext): Promise<SessionTokens> {
    const user = await this.repo.findUserById(userId);
    if (user && isEffectivelyBanned(user)) {
      throw new ForbiddenException({ code: "account_banned", message: this.bannedMessage(user.bannedUntil) });
    }
    return this.issueSession(userId, role, ctx);
  }

  /**
   * Called from UsersService when an admin bans someone — kills every
   * refresh-token session immediately, so the ban takes effect as soon as
   * their current access token naturally expires (at most ACCESS_TOKEN_TTL
   * later), the same latency this app already accepts for role changes.
   */
  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.repo.revokeAllSessionsForUser(userId);
  }

  toPublicUserFrom(user: PrismaUser): PublicUser {
    return this.toPublicUser(user);
  }

  /**
   * A user changing their own password from a page they're already logged
   * into — still requires the CURRENT password, not just a valid session,
   * since a hijacked-but-not-yet-logged-out session shouldn't be enough on
   * its own to lock the real owner out by swapping the password under them.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, ctx: RequestContext): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: "user_not_found", message: "Account no longer exists." });
    }
    if (!user.passwordHash) {
      throw new ConflictException({
        code: "no_password_set",
        message: "This account signs in via Discord/Google and has no password to change.",
      });
    }

    const currentOk = await verifyPassword(user.passwordHash, currentPassword);
    if (!currentOk) {
      throw new UnauthorizedException({ code: "invalid_current_password", message: "Current password is incorrect." });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.repo.updatePassword(userId, passwordHash);
    await this.repo.writeAuditLog({ actorId: userId, action: "user.password_changed", ip: ctx.ip });
    await this.notifications.notify(
      userId,
      "security",
      "تم تغيير كلمة المرور",
      "إذا لم تكن أنت من قام بهذا، تواصل معنا فورًا."
    );
  }

  /**
   * "I forgot my password": mails a one-hour, one-use link to the address if it belongs to an account that has a password.
   * The answer is the same whether or not it does (so this cannot be used to find out who is registered) — the only thing it
   * admits is `available: false` when the site has no mail provider set up yet, so the page can say so instead of promising a
   * mail that will never come. The mail goes out after the answer, so the response time does not tell the two cases apart either.
   */
  async requestPasswordReset(email: string, ctx: RequestContext): Promise<{ available: boolean }> {
    if (!this.mail.enabled) return { available: false };
    const user = (await this.repo.findUserByEmail(email)) ?? (email !== email.toLowerCase() ? await this.repo.findUserByEmail(email.toLowerCase()) : null);
    // An account that signs in only through Discord/Google has no password to reset; a banned one is not helped back in this way.
    if (!user || !user.passwordHash || isEffectivelyBanned(user)) return { available: true };

    const latest = await this.repo.latestPasswordReset(user.id);
    if (latest && Date.now() - latest.createdAt.getTime() < RESET_MAIL_COOLDOWN_MS) return { available: true };

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashResetToken(rawToken);
    await this.repo.replacePasswordReset(user.id, tokenHash, new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000));
    await this.repo.writeAuditLog({ actorId: user.id, action: "user.password_reset_requested", ip: ctx.ip });

    const base = (this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    void this.mail
      .send(passwordResetMail(user.email, `${base}/reset-password#token=${rawToken}`))
      .then(async (sent) => {
        // A mail that did not go out must not leave the person waiting out the cooldown for nothing.
        if (!sent) await this.repo.deletePasswordResetByHash(tokenHash);
      })
      .catch((error) => this.log.warn(`reset mail bookkeeping failed: ${error instanceof Error ? error.message : String(error)}`));
    return { available: true };
  }

  /**
   * Sets the new password from a reset link. The link is spent atomically (a second try with it fails), every other link
   * of the account is dropped, and every signed-in device is signed out — whoever else might be holding a session (the
   * reason a person resets a password in the first place) loses it.
   */
  async resetPassword(rawToken: string, newPassword: string, ctx: RequestContext): Promise<void> {
    const invalid = () => new BadRequestException({ code: "reset_link_invalid", message: "This reset link is invalid or has expired." });
    const row = await this.repo.findPasswordReset(this.hashResetToken(rawToken));
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw invalid();
    const user = await this.repo.findUserById(row.userId);
    if (!user) throw invalid();

    const passwordHash = await hashPassword(newPassword);
    if (!(await this.repo.claimPasswordReset(row.id))) throw invalid();
    await this.repo.updatePassword(user.id, passwordHash);
    await this.repo.deletePasswordResetsForUser(user.id);
    await this.repo.revokeAllSessionsForUser(user.id);
    await this.repo.writeAuditLog({ actorId: user.id, action: "user.password_reset", ip: ctx.ip });
    await this.notifications.notify(user.id, "security", "تمت استعادة كلمة المرور", "تم تعيين كلمة مرور جديدة وتسجيل الخروج من كل الأجهزة. إذا لم تكن أنت، تواصل معنا فورًا.");
  }

  /**
   * Revokes exactly the ONE session this refresh token belongs to — unlike
   * refresh()'s reuse-detection, a normal logout is not an attack signal, so
   * it must not kill the user's other logged-in devices. An unknown/already-
   * invalid refresh token is treated as a no-op, not an error: the caller's
   * actual goal (this token no longer being valid) is already true.
   */
  async logout(rawRefreshToken: string, ctx: RequestContext): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const session = await this.repo.findSessionByRefreshHash(tokenHash);
    if (session && !session.revoked) {
      await this.repo.revokeSession(session.id);
      await this.repo.writeAuditLog({ actorId: session.userId, action: "user.logout", ip: ctx.ip });
    }
  }

  private async issueSession(
    userId: string,
    role: string,
    ctx: RequestContext,
    familyId: string = randomUUID(),
    notifyNewDevice: boolean = true
  ): Promise<SessionTokens> {
    const { device, isNew } = await this.repo.upsertDevice(userId, ctx.deviceFingerprint);
    if (isNew && notifyNewDevice) {
      await this.notifications.notify(
        userId,
        "security",
        "تسجيل دخول من جهاز جديد",
        "إذا لم يكن هذا أنت، غيّر كلمة مرورك فورًا وتواصل معنا."
      );
    }

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

  /** Same keyed hash as the refresh token, under its own label so a token for one purpose can never be replayed for the other. */
  private hashResetToken(raw: string): string {
    return createHmac("sha256", this.refreshPepper).update(`password-reset:${raw}`).digest("hex");
  }

  /** Carries the end date of a temporary ban in the message so the sign-in page can show it. */
  private bannedMessage(bannedUntil: Date | null): string {
    return bannedUntil
      ? `This account is banned until ${bannedUntil.toISOString()}.`
      : "This account has been banned.";
  }

  /** Strips passwordHash (and the avatar bytes themselves) — never let either leave this service, even accidentally via a spread. */
  private toPublicUser(user: PrismaUser): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      displayName: user.displayName,
      bio: user.bio,
      avatarVersion: user.avatarImage ? user.updatedAt.toISOString() : null,
      isBanned: isEffectivelyBanned(user),
      mutedUntil: activeMutedUntil(user),
      hasPassword: user.passwordHash !== null,
      profileVisibility: user.profileVisibility,
      historyVisibility: user.historyVisibility,
      favoritesVisibility: user.favoritesVisibility,
    };
  }
}
