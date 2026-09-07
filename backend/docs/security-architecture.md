# LUNEX TEAM — Backend Architecture & Security Model

This is the document referenced throughout `backend/src` and `backend/prisma/schema.prisma` as "the architecture doc" (`§N` comments point at the sections below). It describes what is actually built and deployed today, not a target state — where something is planned but not yet real, it's marked **Not built yet** explicitly rather than written as if it exists.

Last reconciled against the codebase: 2026-09-07.

---

## §00 — Ground rules

Two rules everything else in this document follows from:

1. **The browser never talks to the backend directly.** Every request from a real user's browser goes to the Next.js frontend, which is the only public entry point. The frontend's server-side Route Handlers (the BFF layer, §1) are the only code that calls the NestJS backend, over a private network. This is why the backend can enforce strict bot/rate-limit rules (§14) without breaking real users — real traffic never presents as a browser hitting the backend at all, it presents as the frontend server hitting it.
2. **Everything server-verified.** A frontend check (hiding a button, disabling a field) is UX, never security. Every mutation re-checks the actor's actual role/ownership against the database inside the NestJS service layer, never trusting a client-supplied role or id. `@Public()` (`common/decorators/public.decorator.ts`) marks the handful of routes that intentionally skip the global auth guard — everything else requires a valid access token by default, opt-out per route rather than opt-in.

---

## §1 — System overview

Two separately deployed apps sharing one GitHub repo:

- **Frontend** — Next.js 15 (App Router), repo root. Renders every page, and is the BFF: its own `/api/*` Route Handlers are the *only* code allowed to call the backend.
- **Backend** — NestJS + Prisma, `backend/`. Owns the real Postgres database. Has no UI of its own.

Both are deployed as separate Railway services from the same repo (Root Directory `backend` for the API service, repo root for the frontend service), plus a managed Postgres service. `DEPLOY.md` at the repo root has the actual click-path; if it disagrees with this section, this section is the current truth (DEPLOY.md was written earlier against a Vercel+Railway split that was later simplified to Railway+Railway).

```
Browser ──────────────▶ Next.js frontend (Railway service #1)
                              │  Route Handlers under src/app/api/*
                              │  (server-to-server, private network)
                              ▼
                        NestJS backend (Railway service #2)
                              │
                              ▼
                        Postgres (Railway managed service)
```

Auth tokens live in httpOnly cookies set by the frontend's Route Handlers — client-side JS never sees a raw access or refresh token. This is the actual reason the BFF pattern was adopted, not just indirection for its own sake.

---

## §2 — Layering inside the backend

Every module follows the same three-file shape:

- **Controller** — HTTP boundary only (§3): decodes the request, calls exactly one service method, returns its result. No business logic.
- **Service** — orchestration and business rules. The only place permission checks, audit logging, and cross-entity logic happen.
- **Repository** — the only place `PrismaService` (or, for the images module, `StorageService`) is called. No business logic here either — just queries.

`AuthService`/`UsersService`/`ImagesService`/`NotificationsService` are the story of what the product does; `*.repository.ts` files are just query builders. Keeping that split intact is what makes `git blame`-ing a business rule change land in one predictable place.

## §3 — HTTP boundary & error handling

Controllers stay thin on purpose — see §2. Errors are centralized in `common/filters/http-exception.filter.ts` (`AllExceptionsFilter`): every thrown exception, whether a deliberate `HttpException` with a `{ code, message }` body or an unexpected crash, is normalized into the same JSON error shape before it reaches the client. The frontend's BFF layer never has to guess what shape a backend error will be in.

---

## §4 — Real vs. mock data (read this before touching anything)

This is the single most important thing to understand about this codebase, and the thing most likely to cause a wrong assumption if skipped.

**Real, Postgres-backed, server-verified** (this backend, `backend/prisma/schema.prisma`):
- `User`, `OAuthAccount` — accounts, profile fields (`displayName`, `bio`, `avatarImage`), roles.
- `Device`, `Session`, `LoginEvent` — auth/device tracking behind the JWT + refresh-rotation scheme (§6).
- `AuditLog` — append-only record of security-relevant actions.
- `ImageAsset`, `ImageAccessLog` — the anti-piracy image pipeline (§9–§11).
- `Notification` — real, persisted, per-user notifications (§12).

**Mock/client-side only** (`src/lib/mock/generate.ts` + a family of Zustand stores under `src/store/`, all `localStorage`-persisted): `Series`, `Chapter`, `Comment`, `Team`, `CustomRole`, recruitment/collaboration requests, and everything derived from them (bookmarks, reading progress, reactions, achievements progress). None of this lives in Postgres. It's generated deterministically in the browser and mutated via an additive "base + added + removed + overrides" overlay pattern (see `mergeComments`/`applyTeamOverride`/the `team-management` store for the canonical shape) — never write-through to a server.

**Why this split exists:** the backend was built out for the account/security surface first (auth, sessions, images, now notifications); the content/catalog side was never migrated off its original mock dataset. It is not an oversight to work around quietly — it is the reason several features in this app are deliberately scoped to what's real:

- Achievements (§13) track *reading progress and authored comments*, both client-tracked, rather than anything requiring a real chapters table.
- Real notifications (§12) only fire for account-security events (password changed, new device, role changed) — there is no real "new chapter from a series you follow" notification, because there is no real chapter table to watch.
- Comment moderation/reporting lives entirely in the mock overlay stores, not this backend, for the same reason.

**Not built yet, and what it would take:** moving `Series`/`Chapter`/`Comment` (and the teams that produce them) into Postgres is the actual prerequisite for content-driven notifications, a real reading-history/achievements backend, and comment moderation with server-side audit logging. That's a multi-table migration + a new set of NestJS modules, not a small patch — treat "make X really real" requests against content data as that scope, not as "hook up one more service."

---

## §5 — Data model (real tables only)

| Table | Purpose |
|---|---|
| `users` | Account: email, username, password hash (nullable — OAuth-only accounts have none), profile fields, avatar bytes, role. |
| `oauth_accounts` | One row per linked external identity (Discord/Google), `@@unique([provider, providerAccountId])`. A user can link multiple providers to one account. |
| `devices` | One row per (user, device-fingerprint) pair. `trustScore` exists in the schema but isn't consumed anywhere yet — reserved for a future step-up-auth signal. |
| `sessions` | Refresh-token sessions, grouped by `familyId` (§6). |
| `login_events` | Every login attempt, success or failure, keyed by email (not just user id, since a failed attempt may not resolve to a real user) — feeds rate-limiting/anomaly detection. |
| `audit_log` | Append-only action log (`actorId`, `action`, `target`, `ip`, `at`). Intentionally loose-typed (`action`/`target` are free strings) rather than one enum per action, so adding a new audited action never requires a migration. |
| `image_assets` / `image_access_log` | The watermarked-image pipeline (§9–§11). |
| `notifications` | Real per-user notifications (§12). |

Every table above is provider-agnostic Prisma (no Postgres-only column types), so the local/dev-vs-prod split is purely the `datasource` block's `provider` value plus a real `DATABASE_URL` — no schema rewrite needed to run this against a different environment.

---

## §6 — Auth: sessions, tokens, and rotation

- **Access token**: short-lived JWT (10 minutes), holds `{ sub: userId, role }`. Never stored anywhere server-side — purely stateless, verified by signature + expiry on every request via the global `JwtAuthGuard`.
- **Refresh token**: a 256-bit random value (not a JWT — no need for a slow hash, it's already CSPRNG output), stored server-side only as an HMAC hash (`refreshTokenHash`) tied to a `Session` row. 7-day expiry.
- **Rotation with reuse detection**: every `/v1/auth/refresh` call revokes the presented session and issues a brand-new refresh token in the same `familyId`. If an already-revoked token is presented again — the signature of a stolen token being replayed after the legitimate user already rotated past it — the *entire family* is revoked and the event is audit-logged as `session.reuse_detected`. A normal logout revokes only the one session, not the family, since logging out isn't itself an attack signal.
- **Devices**: every session issuance calls `upsertDevice(userId, fingerprintHash)`. The fingerprint comes from the frontend (forwarded through unmodified by the BFF, §1) — this backend never generates or weakens it. A first-time fingerprint for an existing user fires a `security` notification (§12); registration is exempted (every device is "new" on your very first login).
- **Password hashing**: Argon2id (`memoryCost: 19456, timeCost: 2, parallelism: 1`). `login()` always runs a verify against *some* Argon2id hash — a real one if the email matched, `getDummyHash()` otherwise — so a nonexistent-email response and a wrong-password response take the same ~100ms, closing the timing side-channel that would otherwise let an attacker enumerate valid emails from response latency alone.

---

## §7 — Target content schema (not built yet)

The eventual real schema for series/chapters/comments/watermark-ledger data (§4) — chapters, per-chapter image tokens modeled the same way §9–§11 already works for avatars/other assets, and a real moderation/audit trail for comments — is intentionally **not** specified further here until that migration is actually scheduled. Speculative schemas rot faster than they help; when this work starts, replace this paragraph with the real design, not before.

---

## §8 — Validation & input handling

Every DTO (`*.dto.ts`) is a `class-validator`-decorated class, and the global `ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true, transform: true` — an unrecognized field in a request body is a hard rejection, not silently dropped or ignored. This is what makes "the frontend only sends what the DTO declares" a backend-enforced guarantee rather than a convention.

---

## §9 — Image access tokens: what's bound into the signature

(See `backend/src/modules/images/crypto/image-token.util.ts`.) An `ImageTokenSigner` issues an HMAC-SHA256-signed token whose payload carries every field that would let a copy-pasted URL work somewhere it shouldn't:

```
{ assetId, userId, deviceFingerprint, expiresAtMs, nonce }
```

Verification (`ImageTokenSigner.verify`) checks structure and signature only — using `timingSafeEqual` for the signature comparison, with a length check first since `timingSafeEqual` throws rather than returning `false` on a length mismatch. Expiry, device-match, and replay checks are deliberately **not** in the signer — they live in `ImagesService`, which also owns the audit trail, so a `token_rejected` log entry always has a reason attached in one place.

## §10 — Image access tokens: expiry, device binding, single use

- **60-second TTL** — short enough that a leaked/shared URL is worthless within minutes.
- **Device-bound** — a token issued to fingerprint A is rejected (`device_mismatch`) if presented from fingerprint B, even with a perfectly valid signature and no expiry. This is what stops "copy the image URL and send it to a friend."
- **Single-use** — `NonceCache.consume()` refuses a nonce it's already seen, so replaying a captured request (via a proxy/repeat tool) doesn't grant a second fetch. **Caveat documented in the code itself**: this cache is in-process memory. A single Railway instance is fine; horizontally scaling this service to multiple instances would need this backed by Redis (`SETNX` with matching TTL) for replay detection to hold across instances. Same caveat applies to the in-memory rate limiter registered in `AppModule`.

## §11 — Image serving: watermark + anti-scraping

`ImagesService.streamAsset()` re-encodes every served image with a tiled, semi-transparent SVG watermark (`user id prefix + exact serve timestamp`, repeated across the image so cropping can't remove every copy) before returning it. This is framed honestly in the code as **deterrence through traceability, not prevention** — anything that has to render onto a screen a human can see can be re-photographed; the point is that a leaked page still carries enough signal to trace which session leaked it.

Layered defenses, cheapest-first (also see `AppModule`'s guard registration order):
1. `BotUserAgentGuard` — rejects known scripted/headless User-Agent strings (curl, python-requests, headless Chrome, common scraper libraries) before any DB or CPU work. Free, but easily spoofed — not relied on alone.
2. `ScrapingVelocityTracker` — per-device-fingerprint heuristic inside `ImagesService.issueToken()`: too many *distinct* pages requested too quickly from one fingerprint trips `scraping_suspected` (429), logged the same way as a rejected token.
3. `ProofOfWorkGuard` (opt-in via `@RequirePow()`) — a CPU-cost challenge on abuse-prone endpoints, raising the cost of high-volume automated requests without affecting a real user's single request.
4. Every `token_issued` / `stream_served` / `token_rejected` event is logged to `image_access_log` with the requesting device fingerprint and IP — cross-referenced with the watermark baked into the pixels, this is the actual leak-tracing ledger if a page ends up redistributed.

---

## §12 — Notifications

Real, Postgres-backed (`Notification` model), scoped so a user can only ever list/mark-read their own rows (every repository method takes `userId` as a filter, not just the notification id). `NotificationsService.notify()` is an internal method other services call — it is **not** its own HTTP endpoint, so a client cannot manufacture a fake notification for itself.

Current producers, all real account-security events:
- Password changed (`AuthService.changePassword`).
- Login from a device-fingerprint never seen before (`AuthService.issueSession`) — suppressed on the very first login right after registration.
- An admin changing a user's role (`UsersService.changeRole`), notifying the affected user.

Per §4, there is no real chapter/comment table yet, so there is no "new chapter" or "someone replied to you" notification — those would need the content migration first, not just a new `notify()` call site.

## §13 — Achievements (client-tracked gamification, not server data)

Achievements (`src/lib/achievements.ts`, `src/store/achievements.ts`) are evaluated entirely client-side against metrics the frontend already tracks locally: cumulative distinct chapters read (`useRewards().allTimeReadKeys`), a reading-day streak (`computeStreak`), authored-comment count, and bookmark count. This is a deliberate scope choice, not a placeholder: none of those metrics have a server-side source of truth yet (§4), so there is nothing for a backend achievements table to be more "real" than what's already tracked. If/when reading history moves server-side, achievements should move with it rather than staying client-only.

---

## §14 — Rate limiting & abuse prevention

- **App-tier default**: `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])` — 120 requests/minute/IP globally, registered as the third global guard (after the bot-UA check and the auth guard, cheapest-rejection-first).
- **Per-route overrides** are stricter where it matters: registration (5/min/IP — slows bulk fake-account creation), login (10/min/IP — credential-stuffing friction), password change (10/min), profile/avatar mutations (10–20/min).
- **Known limitation, stated in the code**: the throttler and the image-pipeline nonce cache (§10) are both in-process memory. This is correct for a single backend instance (the current deployment) and would need a shared store (Redis) the moment this service runs as more than one instance. Per-account (not just per-IP) limiting is noted as the same category of future work.
- **Trusted proxy header**: `RequestContextMiddleware` reads `X-Forwarded-For` for the client IP — this is only safe because the app sits behind a known reverse proxy/CDN (Railway's edge) that sets this header itself. This header must never be trusted on an app that's directly reachable from the open internet without a proxy in front of it verifying/stripping client-supplied values first.

## §15 — Network trust boundary

The backend's own CORS configuration (`main.ts`, `app.enableCors({ origin: CORS_ORIGINS, credentials: true })`) is kept as defense-in-depth even though §00's BFF rule means a real browser never calls this backend cross-origin in normal operation — only the frontend's own server does, over a private network, where CORS (a browser-enforced mechanism) doesn't apply at all. If that ever changes (a mobile app, a third-party integration calling the API directly), this is the point where "the backend is only reachable from the frontend" stops being true and the trust model in §00 needs re-examination, not just a CORS_ORIGINS update.

---

## §16 — Deployment

Both services deploy from the same GitHub repo on push to `master`:

| Service | Root directory | Notes |
|---|---|---|
| Frontend (Next.js) | repo root | Public entry point. `BACKEND_URL` env var points at the backend service's private/public Railway URL. |
| Backend (NestJS) | `backend/` | Not public-facing to end users in intent (§00) — only the frontend calls it. `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_PEPPER`, `IMAGE_TOKEN_SECRET`, `CORS_ORIGINS` as environment variables. |
| Postgres | Railway managed | `DATABASE_URL` shared to the backend via Railway's "Reference Variable." |

**Ephemeral local disk**: Railway wipes each service's local filesystem on every deploy. This is why avatar images are stored as `Bytes` in Postgres rather than on disk (§17), and why the original image-storage design (`IMAGE_STORAGE_DIR` pointing at local disk, per `DEPLOY.md`) is a dev-only convenience — a real deployment of the image pipeline needs object storage (S3/R2), noted as future work below, not local disk.

## §17 — Avatar storage (a deliberate exception to the image pipeline)

User avatars are small (256×256, re-encoded to WebP) and stored directly as `Bytes` in the `users` table, served by a `@Public()` endpoint with a long-lived immutable cache header — **not** routed through the watermarked/token-gated pipeline in §9–§11. This is intentional, not an inconsistency: an avatar is exactly as visible as any other public-profile field (display name, bio), viewable by anyone whether logged in or not. The token-gated pipeline exists to protect copyrighted page content from scraping; an avatar has no equivalent anti-piracy concern, so reusing that machinery for it would be the wrong tool, not extra security.

## §18 — Migrations without a live local database

Local development has no live Postgres connection in this environment. Migrations are generated with:

```bash
npx prisma migrate diff --from-schema-datamodel <previous-schema-snapshot> --to-schema-datamodel <current-schema> --script > migration.sql
```

**Redirect stderr to a separate file, never merge it into the SQL output** — a real incident during this project's development had a Prisma "update available" banner (stderr) get captured into a migration file via `2>&1`, corrupting it. `npx prisma generate` (schema-only, no DB connection needed) regenerates the TypeScript client after any schema edit. Railway's deploy step runs `prisma migrate deploy` against the real database automatically.

---

## §19 — Known gaps and future work (honest list, not a roadmap promise)

- **Content data is still mock/client-only** (§4/§7) — the actual prerequisite for a large share of "make this real" requests (content-driven notifications, server-side achievements, comment moderation with a real audit trail, cross-device bookmark sync).
- **In-memory rate limiter and image-token nonce cache** (§10/§14) — fine at one instance, needs Redis the moment this scales horizontally.
- **No object storage yet** — avatar bytes in Postgres (§17) work at current scale; a real chapter-image pipeline (§7) would need S3/R2, not local disk or a DB column.
- **No shared types package between frontend and backend** — `UsersService`'s permission model (`ROLE_MANAGER_ROLES`) is deliberately duplicated from the frontend's `rbac.ts` rather than imported, since the two apps don't share a types/contracts package. Documented at the point of duplication so the two don't silently drift; a real fix is a `packages/contracts`-style shared package, not copy-paste discipline alone.
- **Device `trustScore`** exists as a schema column but nothing reads or writes it yet — reserved for a future step-up-auth signal (e.g. requiring re-verification on a low-trust device attempting a sensitive action).

## §20 — Audit log immutability (partially built — read before citing this as done)

`audit_log` is append-only *by application convention* — no code path in this repo ever updates or deletes a row in it. The Prisma schema comment on that model additionally claims the production Postgres deployment "revokes UPDATE/DELETE at the DB role grant level," citing this section. That claim describes an *intended* hardening step, not a verified one: doing that requires running `REVOKE UPDATE, DELETE ON audit_log FROM <app_role>` directly against the Railway Postgres instance, outside of anything Prisma migrations express (`schema.prisma` has no concept of role grants). Nothing in this repo's migration history shows that `REVOKE` having been run. Treat DB-level immutability as **not yet confirmed** until someone has actually checked the live database's role grants — application-level append-only discipline is real today; the extra DB-enforced layer is not confirmed real yet.
