# LUNEX TEAM — Backend Architecture & Security Model

This is the document referenced throughout `backend/src` and `backend/prisma/schema.prisma` as "the architecture doc" (`§N` comments point at the sections below). It describes what is actually built and deployed today, not a target state — where something is planned but not yet real, it's marked **Not built yet** explicitly rather than written as if it exists.

Last reconciled against the codebase: 2026-09-08.

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
- `ImageAsset`, `ImageAccessLog`, `ImageBlob` — the anti-piracy image pipeline (§9–§11, §21).
- `Notification` — real, persisted, per-user notifications (§12).
- `Chapter`, `ChapterPage`, `ChapterUnlock` — real chapter metadata, page-to-image linkage, and per-user entitlements (§7, §21). `seriesId`/`teamId` on `Chapter` are plain strings, not foreign keys — see the next bullet.

**Mock/client-side only** (`src/lib/mock/generate.ts` + a family of Zustand stores under `src/store/`, all `localStorage`-persisted): `Series`, `Comment`, `Team`, `CustomRole`, recruitment/collaboration requests, and everything derived from them (bookmarks, reading progress, reactions, achievements progress, the coins/ads-credits economy). None of this lives in Postgres. It's generated deterministically in the browser and mutated via an additive "base + added + removed + overrides" overlay pattern (see `mergeComments`/`applyTeamOverride`/the `team-management` store for the canonical shape) — never write-through to a server. `Chapter.seriesId`/`teamId` reference these mock ids directly, with no FK, the same convention `ImageAccessLog.assetId` already used before any of this existed.

**Why this split exists:** the backend was built out for the account/security surface first (auth, sessions, images, notifications), then chapter/page *content* once the image-protection pipeline needed something real to protect (§21) — but the surrounding catalog (series, teams, comments) never migrated off its original mock dataset. It is not an oversight to work around quietly — it is the reason several features in this app are deliberately scoped to what's real:

- Achievements (§13) track *reading progress and authored comments*, both client-tracked, rather than anything requiring a real chapters table (which now exists, but achievements weren't revisited when it landed — see §19).
- Real notifications (§12) only fire for account-security events (password changed, new device, role changed) — there is still no real "new chapter from a series you follow" notification. Chapters becoming real (§21) removed the *technical* blocker for this specific one; it just hasn't been wired up.
- Comment moderation/reporting lives entirely in the mock overlay stores, not this backend, since `Comment` is still mock-only.
- Chapter *upload* authorization (§21) deliberately checks only the caller's real global `User.role`, not real team membership — `Team`/`TeamRole` are still mock, so a genuine per-team check isn't possible yet without migrating those too.

**Not built yet, and what it would take:** moving `Series`/`Comment`/`Team` into Postgres is the remaining prerequisite for content-driven notifications with real per-series subscriptions, comment moderation with server-side audit logging, and team-scoped (not just global-role) publish permissions. That's a multi-table migration + new NestJS modules, not a small patch — treat "make X really real" requests against series/team/comment data as that scope, not as "hook up one more service." Chapters/pages themselves are already past this bar (§21).

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
| `image_assets` / `image_access_log` | The protected-image pipeline (§9–§11). |
| `image_blobs` | Interim Postgres-backed byte storage for real chapter-page images (§16, §21) — not the permanent home at scale. |
| `notifications` | Real per-user notifications (§12). |
| `chapters` / `chapter_pages` / `chapter_unlocks` | Real chapter metadata, page-to-`image_assets` linkage, and per-user entitlements (§7, §21). |

Every table above is provider-agnostic Prisma (no Postgres-only column types), so the local/dev-vs-prod split is purely the `datasource` block's `provider` value plus a real `DATABASE_URL` — no schema rewrite needed to run this against a different environment.

---

## §6 — Auth: sessions, tokens, and rotation

- **Access token**: short-lived JWT (10 minutes), holds `{ sub: userId, role }`. Never stored anywhere server-side — purely stateless, verified by signature + expiry on every request via the global `JwtAuthGuard`.
- **Refresh token**: a 256-bit random value (not a JWT — no need for a slow hash, it's already CSPRNG output), stored server-side only as an HMAC hash (`refreshTokenHash`) tied to a `Session` row. 7-day expiry.
- **Rotation with reuse detection**: every `/v1/auth/refresh` call revokes the presented session and issues a brand-new refresh token in the same `familyId`. If an already-revoked token is presented again — the signature of a stolen token being replayed after the legitimate user already rotated past it — the *entire family* is revoked and the event is audit-logged as `session.reuse_detected`. A normal logout revokes only the one session, not the family, since logging out isn't itself an attack signal.
- **Devices**: every session issuance calls `upsertDevice(userId, fingerprintHash)`. The fingerprint comes from the frontend (forwarded through unmodified by the BFF, §1) — this backend never generates or weakens it. A first-time fingerprint for an existing user fires a `security` notification (§12); registration is exempted (every device is "new" on your very first login).
- **Password hashing**: Argon2id (`memoryCost: 19456, timeCost: 2, parallelism: 1`). `login()` always runs a verify against *some* Argon2id hash — a real one if the email matched, `getDummyHash()` otherwise — so a nonexistent-email response and a wrong-password response take the same ~100ms, closing the timing side-channel that would otherwise let an attacker enumerate valid emails from response latency alone.

---

## §7 — Chapter/page content schema (now real — see §21 for the full pipeline)

`Chapter` / `ChapterPage` / `ChapterUnlock` (added alongside the anti-piracy image rebuild, §21) are real, server-verified tables — this section used to say "not built yet"; that's no longer true for chapters/pages specifically, even though `Series`/`Comment`/`Team` around them are still mock (§4).

- `Chapter`: `seriesId`/`teamId` are plain strings (no FK — those aren't real tables), `number` (float, so bonus/half chapters work), `title`, `isPublished`, `scheduledFor`, `manualLock` (mirrors the frontend's `isChapterLocked()` manual override: `true` force-locked, `false` force-open, `null` = automatic sliding window).
- `ChapterPage`: `pageNumber` is an explicit column (not an array index), unique per `(chapterId, pageNumber)`; `assetId` is a real FK to `ImageAsset`.
- `ChapterUnlock`: `(userId, chapterId)` unique — a real, durable "this user has paid/earned access to this chapter" fact, replacing the client-only `unlockedChapters` localStorage flag as what `issueToken()`-adjacent authorization actually checks (§21). Deliberately **not** tied to a real payments/currency backend — see §21's note on `ChaptersService.unlock()`.

`ImageAsset` itself gained `mimeType`/`width`/`height` at the same time, needed so the tiling step (§21) can pick a grid without re-decoding the image just to read its dimensions.

---

## §8 — Validation & input handling

Every DTO (`*.dto.ts`) is a `class-validator`-decorated class, and the global `ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true, transform: true` — an unrecognized field in a request body is a hard rejection, not silently dropped or ignored. This is what makes "the frontend only sends what the DTO declares" a backend-enforced guarantee rather than a convention.

---

## §9 — Image access tokens: what's bound into the signature

(See `backend/src/modules/images/crypto/image-token.util.ts`.) An `ImageTokenSigner` issues an HMAC-SHA256-signed token whose payload carries every field that would let a copy-pasted URL work somewhere it shouldn't:

```
{ assetId, userId, deviceFingerprint, expiresAtMs, nonce, bundleKey }
```

`bundleKey` (added with §21's tile-encryption work) is a random 32-byte, single-use symmetric key generated at issuance — it rides inside this same signed payload rather than living in a separate key-management system. It isn't a secret the *server* needs to protect from the *client*: the client is always meant to read it (by base64url-decoding the token body itself, no round-trip needed) so it can decrypt the one tile bundle that token authorizes. What it must resist is forgery and reuse, which the existing signature + single-use nonce already cover — see §21.

Verification (`ImageTokenSigner.verify`) checks structure and signature only — using `timingSafeEqual` for the signature comparison, with a length check first since `timingSafeEqual` throws rather than returning `false` on a length mismatch. Expiry, device-match, and replay checks are deliberately **not** in the signer — they live in `ImagesService`, which also owns the audit trail, so a `token_rejected` log entry always has a reason attached in one place.

## §10 — Image access tokens: expiry, device binding, single use

- **60-second TTL** — short enough that a leaked/shared URL is worthless within minutes.
- **Device-bound** — a token issued to fingerprint A is rejected (`device_mismatch`) if presented from fingerprint B, even with a perfectly valid signature and no expiry. This is what stops "copy the image URL and send it to a friend."
- **Single-use** — `NonceCache.consume()` refuses a nonce it's already seen, so replaying a captured request (via a proxy/repeat tool) doesn't grant a second fetch. **Caveat documented in the code itself**: this cache is in-process memory. A single Railway instance is fine; horizontally scaling this service to multiple instances would need this backed by Redis (`SETNX` with matching TTL) for replay detection to hold across instances. Same caveat applies to the in-memory rate limiter registered in `AppModule`.

## §11 — Image serving: tiling/encryption, anti-scraping and the access log

`ImagesService.streamAsset()` slices every served image into tiles and encrypts the bundle — see §21 for the full pipeline (this section predates that work and originally described a plain watermarked PNG response; it no longer returns that). **There is no visible watermark any more (removed 2026-09-26, the owner's decision).** The overlay repeated the first 8 characters of the account id and a session code diagonally over every page; on the server it was drawn in a `monospace` font that the container does not have, so it came out as rows of empty boxes — unreadable, so useless for tracing, while cluttering every page. What is left is honest about its limits: anything that has to render onto a screen a human can see can be re-photographed, and a leaked page no longer carries a mark of its own; tracing a leak now rests on the access log below (who was issued and served which page, from which device and IP, and when), the short-lived single-use tokens, the scraping-velocity limit and the encryption in transit. If a visible or invisible mark is wanted again, it belongs in `ImagesService.streamAsset` before `buildTileBundle`, drawn with a font shipped in the image (or as an invisible perturbation) and checked on the deployed server, not only locally.

Layered defenses, cheapest-first (also see `AppModule`'s guard registration order):
1. `BotUserAgentGuard` — rejects known scripted/headless User-Agent strings (curl, python-requests, headless Chrome, common scraper libraries) before any DB or CPU work. Free, but easily spoofed — not relied on alone.
2. `ScrapingVelocityTracker` — per-device-fingerprint heuristic inside `ImagesService.issueToken()`: too many *distinct* pages requested too quickly from one fingerprint trips `scraping_suspected` (429), logged the same way as a rejected token.
3. `ProofOfWorkGuard` (opt-in via `@RequirePow()`) — a CPU-cost challenge on abuse-prone endpoints, raising the cost of high-volume automated requests without affecting a real user's single request.
4. Every `token_issued` / `stream_served` / `token_rejected` event is logged to `image_access_log` with the requesting device fingerprint and IP — this is now the leak-tracing ledger if a page ends up redistributed (it says who fetched a page and when, not which copy leaked).

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
- **Trusted proxy header**: `RequestContextMiddleware` reads `X-Forwarded-For` for the client IP — this is only safe because the app sits behind a known reverse proxy/CDN (Railway's edge) that sets this header itself. This header must never be trusted on an app that's directly reachable from the open internet without a proxy in front of it verifying/stripping client-supplied values first. That value is only good enough for an audit log, and since every browser request arrives through the frontend it names the frontend, not the visitor — see the next bullet.
- **Per-visitor limiting (BFF identity).** The frontend works out the visitor's address (`src/lib/client-ip.ts`: `X-Real-IP`, then the first `X-Forwarded-For` entry — Railway's edge sets both to the address of the connection it saw and discards whatever the visitor sent under those names (checked against production: a request carrying a made-up `X-Forwarded-For`/`X-Real-IP` still arrived with its own address), whereas the *last* `X-Forwarded-For` entry is one of Railway's own hops and changes from request to request; behind Cloudflare, `CF-Connecting-IP`, but only when the request also carries `x-lunex-edge` equal to `CF_EDGE_SECRET`, a header a Cloudflare Transform Rule adds, because anyone can send `CF-Connecting-IP` straight to the Railway address) and passes it to the backend in `x-lunex-client-ip` beside `x-lunex-bff-key`, a secret shared by the two services (`BFF_SHARED_KEY` on both). The backend takes the address as real (`ctx.ipVerified`) only with the right key (constant-time compare) and a syntactically valid IP; anything else is ignored. `ClientIpThrottlerGuard` counts per verified address and keeps counting everyone else by the connection's address, so a caller cannot get a fresh budget by claiming a different one. Without `BFF_SHARED_KEY` nothing changes (the old shared budget), so it can be deployed before the setting. `GET /api/auth/client` shows, for the caller, the address the frontend worked out, the forwarding chain, and the address and `verified` flag the backend ended up with (plus which side lacks the key) — the way to check a deploy from outside. Checked against a local backend: one visitor is limited after 10 login attempts while another address on the same key is not, and a caller without the key claiming twelve different addresses is still limited as one.

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

**Ephemeral local disk**: Railway wipes each service's local filesystem on every deploy. This is why avatar images are stored as `Bytes` in Postgres rather than on disk (§17), and why real chapter-page bytes (§21) default to the same Postgres-backed approach (`PrismaBlobStorageService`) rather than the local-disk `StorageService` implementation, which stays available (`IMAGE_STORAGE_BACKEND=local`) purely as a zero-infra way to run the pipeline locally. Both are interim until a real object store (S3/R2) exists — noted as future work below.

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

- **Series/Team/Comment are still mock/client-only** (§4) — chapters/pages cleared this bar (§7/§21); the catalog around them didn't. This is the remaining prerequisite for content-driven notifications with real subscriptions, comment moderation with a real audit trail, and team-scoped (not just global-role) publish permissions.
- **Chapter upload authorization is global-role-only, not team-scoped** (§21) — a deliberate, bounded gap: any account with a real "can publish" global role can upload to any series/team via the API, even though the admin UI only shows the button per the mock team-permission system. Closing this for real requires migrating `Team`/`TeamRole` to Postgres, which is bigger than the image-protection work that motivated §21.
- **Chapter unlocking has no real payments backend behind it** (§21, `ChaptersService.unlock()`) — it unconditionally trusts the caller, same level of trust the client-only coins/ads-credit economy already operates at today. Hardening *that* economy against self-unlocking is a separate scope from anti-scraping/piracy protection, which is what §21 was actually built for.
- **Achievements (§13) weren't revisited when chapters became real (§21)** — they still track client-side reading progress rather than the new real `ChapterUnlock`/read data. Not urgent, just noted so "chapters are real now" isn't assumed to have silently upgraded achievements too.
- **In-memory rate limiter and image-token nonce cache** (§10/§14) — fine at one instance, needs Redis the moment this scales horizontally.
- **No object storage yet** — avatar bytes and now chapter-page bytes both live in Postgres (§17, §21) as an interim measure; real scale needs S3/R2, not a DB column. `StorageService`'s interface (§21) is deliberately the only thing that would need to change.
- **No shared types package between frontend and backend** — `UsersService`'s permission model (`ROLE_MANAGER_ROLES`) and `ChaptersService`'s (`CAN_PUBLISH_GLOBAL_ROLES`) are both deliberately duplicated from the frontend's `rbac.ts` rather than imported, since the two apps don't share a types/contracts package. Documented at the point of duplication so the two don't silently drift; a real fix is a `packages/contracts`-style shared package, not copy-paste discipline alone.
- **Device `trustScore`** exists as a schema column but nothing reads or writes it yet — reserved for a future step-up-auth signal (e.g. requiring re-verification on a low-trust device attempting a sensitive action).

## §20 — Audit log immutability (partially built — read before citing this as done)

`audit_log` is append-only *by application convention* — apart from one deliberate exception, `RetentionService` (§23), which deletes rows older than the audit retention window (365 days by default), no code path in this repo ever updates or deletes a row in it. **If the `REVOKE` below is ever applied, that sweep starts failing** (it is logged and retried, never fatal) — give the retention job its own database role that keeps `DELETE` on the log tables before doing so. The Prisma schema comment on that model additionally claims the production Postgres deployment "revokes UPDATE/DELETE at the DB role grant level," citing this section. That claim describes an *intended* hardening step, not a verified one: doing that requires running `REVOKE UPDATE, DELETE ON audit_log FROM <app_role>` directly against the Railway Postgres instance, outside of anything Prisma migrations express (`schema.prisma` has no concept of role grants). Nothing in this repo's migration history shows that `REVOKE` having been run. Treat DB-level immutability as **not yet confirmed** until someone has actually checked the live database's role grants — application-level append-only discipline is real today; the extra DB-enforced layer is not confirmed real yet.

## §21 — The chapter-image anti-piracy pipeline

Built to replace an earlier state where none of this was wired up at all: the reader fetched placeholder pages directly from `picsum.photos` with zero protection, and this backend's token/watermark machinery (§9–§11), while well-designed, had no real caller. The full design rationale and the parts of the original 38-point spec that were deliberately simplified or skipped (WASM, a 4-level key hierarchy, 400 tiles/page, invisible/steganographic watermarking, CDN signed URLs, Service Worker mediation) live in the approved plan this was built from — summarized here as the parts that actually shipped.

**Upload** (`ChaptersModule`, admin-only): drag-drop ordered image files → `POST /v1/chapters` (metadata) → `POST /v1/chapters/:id/pages` per file (multipart, `FileInterceptor` + `memoryStorage()`, same shape as avatar upload) → validate via `sharp` (must decode, dimensions ≤ 6000px) → re-encode to WebP (strips EXIF as a side effect) → checksum → `StorageService.put()` under a random key → `ImageAsset` + `ChapterPage` rows. A duplicate page number is rejected outright (`ConflictException`), not silently overwritten — replacing a mis-uploaded page means deleting the chapter and re-uploading, an accepted v1 limitation.

**Authorization** (`ChaptersService.canAccessChapter`/`issuePageToken`): the real gate `issueToken()` never had. Ports the frontend's sliding free-chapter-window math (`isChapterLocked()` in `src/store/rewards.ts`) server-side against the real `Chapter.number`/`manualLock`, falling back to a real `ChapterUnlock` row. `ChaptersController` owns this check and *then* calls `ImagesService.issueToken()` to actually mint the token — `ImagesService` itself stays authorization-agnostic (token mechanics only), which is also what avoids a circular module dependency between chapters and images (images doesn't need to know about chapters at all).

**Serving** (`ImagesService.streamAsset`, unchanged token verification, new payload): loads the real image bytes → `buildTileBundle()` (`tiling/tile-bundle.util.ts`; the page is decoded once and every tile cut from the raw pixels, which measured about 40% faster than cutting each tile from the stored WebP) slices it into an adaptive grid (`Math.round(dimension / 650px)`, clamped 2×2..5×5 — never a blind fixed count that would blow up request/CPU cost on a huge page) → shuffles the tiles into random send order → serializes one plaintext payload (`[4-byte manifest length][manifest JSON][tile bytes concatenated in that same shuffled order]`) → `encryptBundle()` AES-256-GCM-encrypts the whole thing with the token's own `bundleKey` (§9), wire format `[12-byte IV][ciphertext][16-byte tag]`. The HTTP response is `application/octet-stream` — opaque bytes, never a directly-openable image, closing the gap the old plain-PNG response had (anyone could see and re-open the real image URL in DevTools' Network tab; now they'd see the real *request* but the *response* is useless without the one-time key that already left with the (expired, single-use) token).

**Client** (`src/components/reader/protected-page.tsx`): requests a page token, decodes `bundleKey` straight out of the token body (no secret needed to read it — see §9), fetches the encrypted bundle, `crypto.subtle.decrypt`s it (Web Crypto, AES-GCM), parses the manifest, and draws each tile onto `<canvas>` at its recorded position via `createImageBitmap`. No `<img src>` exists anywhere in this path. `src/components/reader/reader-viewer.tsx` checks per-chapter whether a real backend `Chapter` exists for the series+number and renders this component for it; a chapter that hasn't been migrated through the new upload flow keeps working exactly as before via the original mock `picsum.photos` + `ProtectedImage` path — the two coexist deliberately during the gradual migration (§4).

## §22 — Storage backend selection

`StorageService` (`storage/storage.interface.ts`) is an abstract class used purely as a Nest DI token, with two implementations bound in `ImagesModule` via a factory keyed on `IMAGE_STORAGE_BACKEND`:
- unset or anything but `"local"` → `PrismaBlobStorageService` (Postgres `image_blobs` table) — the production default, since Railway's disk is wiped every deploy (§16) and no S3/R2 exists yet.
- `"local"` → `LocalDiskStorageService` — dev-only, zero-infra way to run the pipeline without touching the database.

Both `get`/`put` the same opaque `storageKey` shape; nothing above `StorageService` (not `ImagesService`, not `ChaptersService`) knows or cares which backend is active. Swapping either to a real S3/R2-backed implementation later touches only a new class plus this one factory binding.

## §23 — Data retention, account deletion and export

The privacy policy (`src/app/(main)/privacy`) promises specific retention periods and self-service data rights. This section is where those promises are backed by code — change the policy page and these together.

**Retention** (`modules/retention/retention.service.ts`): a process-local timer (first sweep 5 minutes after boot, then every 24 h; no scheduler dependency) deletes rows past their window in batches of 5,000 — `login_events` after 90 days, `image_access_log` after 180 (it is the leak-tracing ledger, so it is kept longest of the IP-only logs), `audit_log` after 365, and softly-removed comments after 90 (§26). Overridable with `RETENTION_LOGIN_EVENTS_DAYS` / `RETENTION_IMAGE_ACCESS_DAYS` / `RETENTION_AUDIT_DAYS` / `RETENTION_REMOVED_COMMENTS_DAYS`; any value under 7 or non-integer is ignored in favour of the default so a typo can never mean "delete everything". Deletes are idempotent, so a second instance running the same sweep is harmless. The `at` indexes on the three tables (migration `20260925000000_add_log_time_indexes`) keep the daily sweep from scanning them in full. **Not covered:** expired `sessions` rows, and `devices` for live accounts, are not swept — they are removed with their account.

**Account deletion** (`DELETE /v1/users/me`, `UsersService.deleteAccount`): re-checks the caller's credentials (password, or retyping the username for a Discord/Google-only account), refuses the `owner` role, then in one transaction deletes the user (schema cascades remove sessions, devices, OAuth links, notifications and chapter unlocks), deletes every `login_events` row by `userId` *and* by email, and writes a `user.account_deleted` audit entry with no IP. `image_access_log` and `audit_log` rows are deliberately kept until their retention window ends (leak tracing and abuse review need them); after the user row is gone their `userId`/`actorId` no longer resolves to anyone. The privacy policy states this exception.

**Export** (`GET /v1/users/me/export`, `UsersRepository.collectExport`): an allow-list of columns per table — never `include`/spread — so `passwordHash`, refresh-token hashes and device fingerprint hashes cannot appear even if the schema grows. Log tables are capped at the newest 1,000 rows each.

Both endpoints are throttled to 5 per 10 minutes. The frontend clears every `lunex-*` localStorage key after a successful deletion, since the comment/bookmark/message stores are device-local and the server cannot reach them.

## §24 — Public profiles, privacy levels and the server-side library

`ProfilesModule` (`modules/profiles`) backs the public profile page at `/profile/:username`.

**Visibility.** `User` has three columns — `profileVisibility` (default `public`), `historyVisibility` and `favoritesVisibility` (both default `private`) — each `public` | `members` (any signed-in account) | `private` (owner + staff). One rule decides every section (`profile-visibility.util.ts` → `canView`); an unrecognised value counts as private. A hidden section is **omitted from the response**, not sent empty, and a private profile page returns only the identity (username, display name, picture, role) whatever the section levels say — that identity is already public wherever the account comments. The owner and moderators (`MODERATOR_ROLES` in `common/roles.ts`: owner, super_administrator, moderator) see everything; the viewer's role is re-read from the database, not taken from a token that can be ten minutes stale. Only the owner and staff are told which level each section is set to.

**Optional auth on public routes.** `JwtAuthGuard` now attaches `request.user` on a `@Public()` route when a *valid* token is sent (a missing, expired or forged one is simply anonymous, never a 401). That is how `GET /v1/profiles/:username` knows whether the viewer is signed in for a "members only" section.

**Library.** `Bookmark` (favorites) and `ReadingProgress` (furthest chapter per series, `lastReadAt` for ordering) replace what used to live only in each browser's localStorage. `seriesId` is a plain string, not a foreign key (Series is still mock — §4). Progress is written with a single `INSERT … ON CONFLICT DO UPDATE SET chapterNumber = GREATEST(…)` so two tabs can never move it backwards. `POST /v1/profiles/me/library/sync` merges a local library up as a union / furthest-chapter and silently drops malformed entries. The frontend side (`components/library-sync.tsx`) is keyed on the *server-verified* session, tracks whose library the browser mirrors (`lunex-library-owner`) so one account never inherits another's on a shared browser, merges up only the first time, and pulls thereafter.

**Was a known limitation, now fixed (once `BFF_SHARED_KEY` is set).** The BFF did not forward the visitor's IP, so the backend's per-IP throttler (`@Throttle`, default 120/min) saw every visitor as the BFF and shared one budget across all users — which mattered more once every chapter read produced a progress write. The frontend now forwards the visitor's address under a shared secret and the throttler counts per visitor (§14, "Per-visitor limiting"); the header is trusted only with the secret, so the backend being reachable directly does not let anyone spoof it.

## §25 — Moderation: warnings, timeouts and bans

`ModerationModule` (`modules/moderation`) records and enforces staff actions against accounts.

**Model.** A `Sanction` row is the history (type `warning` | `timeout` | `ban`, reason, who, when, `expiresAt`, and `revokedAt`/`revokedById` if lifted early). The *current effect* is denormalised onto `User` so hot paths need no join: `mutedUntil` (timeout), and `isBanned` + `bannedUntil` (`null` = permanent). Creating or lifting a sanction updates both in one transaction; a ban also revokes every session in that transaction.

**Expiry needs no job.** Nothing runs when a timeout or temporary ban ends — every check goes through `isEffectivelyBanned()` / `isMuted()` (`moderation.util.ts`), which compare against `now`. `User.isBanned` can therefore stay `true` after `bannedUntil` passes; only the helper's answer is authoritative, and it is what the API reports as `isBanned` and `mutedUntil`.

**Who may do what** (re-read from the database on every call, never from the token). Warn and time out: `MODERATOR_ROLES` (owner, super_administrator, moderator); a moderator's timeout is capped at 30 days. Ban and lift a ban: `BAN_ROLES` (owner, super_administrator). Nobody sanctions themselves, an owner, or anyone of equal or higher `ROLE_RANK`. The older `PATCH /v1/users/:id/ban` toggle now delegates to this module, so the two paths cannot disagree.

**Other staff actions on an account** (same actor gate and rank rules as a sanction, all audited): `POST …/reset-profile` clears the avatar, bio and/or display name (the avatar bytes are really removed; the person is told what and why); `POST …/remove-comments` soft-deletes every comment the account has posted (§26); `POST …/sign-out` revokes every session — a security measure, so no penalty record and no notice. The first two are written to the history as one-off records (`profile_reset`, `comments_removed`, with `Sanction.details` saying which parts / how many); they are never "active" and cannot be lifted. `GET …/sanctions` also returns an `account` block — email, join date, last successful sign-in, live session count, sign-in methods, visible comment count, **no IPs or hashes** — but only to `BAN_ROLES`; a moderator gets `null`. Role changes stay on the older `PATCH /v1/users/:id/role`; the moderation panel just calls it.

**Enforcement status.** Bans are enforced server-side at sign-in, refresh and OAuth, and again on every comment write. Timeouts are enforced server-side for **comments** (§26: `isMuted()` is checked on create and on content edits); **messages** are still device-local (§4), so for them the timeout is UI-only until they move to the server. `GET /v1/auth/me` returns `mutedUntil` so the composers can disable themselves and say until when. Sanction records are deleted with the account (cascade) and included in the data export.

## §26 — Comments

Real accounts' comments live in `comments` (`modules/comments`); the demo catalogue's seeded comments are still mock data merged in on the client. `seriesId` is a plain string like everywhere else (§4). There is no reply threading yet.

**Enforcement is server-side** — this is what makes §25's timeout real. `create` and content edits re-read the account from the database and refuse a banned account (`account_banned`) or one in a timeout (`account_muted`, the end time in the message). Rate limits are **per account**, not per IP (the per-IP throttler sees every visitor as the BFF — §24): 5 comments a minute, 60 an hour, plus an identical-text check over five minutes. Text is cleaned (`comment-text.util.ts`: zero-width and bidi-control characters, control characters, blank-line runs) and an over-long comment is rejected with a 400 rather than silently cut.

**Who can change what.** Text: the author only — not even staff can rewrite someone's words, and a timed-out author can't edit either (that would be posting through the back door). Spoiler flag: the author or staff. Pin: staff. Delete: the author removes their comment for good (hard delete); staff remove someone else's **softly** (`deletedAt`/`deletedById`, audited, the author is notified) and cannot remove a higher-ranked member's. Reactions: one per account per comment, not on your own; reacting is allowed while timed out. Reports: one per reporter per comment; staff see a queue (`GET /v1/comments/reports/queue`) and can dismiss it or remove the comment.

**Retention and deletion.** Softly removed comments are purged after 90 days (`RetentionService`, `RETENTION_REMOVED_COMMENTS_DAYS`). Deleting an account cascades to its comments, the reactions and reports on them, and the reactions and reports it made. Comments are in the data export.

**Known gaps.** Replies and per-chapter comment threads aren't modelled. The "comments" achievement is fed by a local tally of posts (`postedOnServer`), not derived from the server.

## §27 — The catalogue (series, teams, tags, news) and the import from the old site

`CatalogModule` (`modules/catalog`) is the database side of what the frontend used to generate as mock data. Tables: `series`, `series_tags`, `tags`, `teams`, `team_members`, `news_items`; `chapters` gained `publishedAt`, `viewCount`, `content` (novel text) and `legacyId`. Series/team/news pictures are `ImageAsset` rows behind the same `StorageService` as chapter pages (§22), served by public endpoints with a version stamp in the URL so they can be cached for a year.

**Reads.** `GET /v1/catalog/bootstrap` returns everything a page render needs in the frontend's own shapes (`Series`, `Team`, `Chapter`, `User`-like people, tags as genres) — series with derived chapter counts / latest chapter / favorites, the 60 newest chapters, news, teams ranked by output, and top readers. It is deliberately not paginated yet (a few hundred series is a small payload and the explore page filters client-side) and is memoised for 15 s in `CatalogService`; every catalogue write calls `invalidate()`. Catalogue reads are `@SkipThrottle()` because the per-IP limiter sees the whole site as one IP (§24). `topReaders` only includes accounts whose reading history is public.

**Writes** (`CatalogAdminService`, roles re-read from the database): series and tags — owner, super_administrator, editor; teams — owner, super_administrator, global_team_manager; news — owner, super_administrator, news_manager. A team's own leader (or a member with a lead role) may edit that team and its series and add series to it, but not feature a series, change its visibility or team, delete it, or change a team's status/leader. Unknown tag slugs are rejected, not dropped; slugs keep Arabic letters and are made unique with a numeric suffix. Deleting a series also deletes its chapters, comments, favorites and reading progress (those reference it by plain string id).

**Import from lunexteam.com** (`legacy/`). `POST /v1/catalog/import/legacy`, owner only, 3 per hour: reads the old site's public API (tags, groups, manga) and each title page (the only place the cover's CDN address appears), and copies tags, teams, series and covers. Everything is matched on the old id (`legacyId`) and only ever **created** — re-running never overwrites an editor's changes and never deletes. Imported teams have no leader (the old leader accounts cannot be carried over); tags get Arabic names from a table in `legacy-mapper.ts`; the original language decides country and type. Chapters and their page images are a separate step (they need object storage, §22).

**How the frontend reads it.** The root layout fetches `bootstrap` on the server (`catalog-server.ts`, cached per request and for 15 s by Next) and hands it to `CatalogProvider`; client pages call `useCatalog()` and server pages `loadCatalog()`, both returning the same shape the sample-data generator used, so pages did not change how they read it. Chapter lists are fetched per series (`GET /v1/catalog/series/:slug`) — the bootstrap only carries the newest chapters and headline counts (`stats`). While the database has no series (or is unreachable) the site falls back to the built-in sample data, so a fresh deployment is never blank; the fallback is to be removed once the import has run everywhere. Team management pages (recruitment, kanban, requests) are still local-store features and are empty under the real catalogue until they move to the server.

**Deploys cannot take the site down (learned 2026-09-25).** The first catalogue deploy failed because an earlier, since-reverted import experiment (migration `20260909080000`) had left `teams` and `series` tables in production; the failed migration blocked every later start (Prisma P3009) and, with no healthcheck, the crashing build had already replaced the healthy one. Three guards now exist: (1) migration `add_catalog` first moves such legacy tables aside as `legacy_import_teams` / `legacy_import_series` (data kept) and does nothing on a database that never had them; (2) `scripts/resolve-failed-migrations.cjs` runs before `migrate deploy` in `start:prod` and marks a *failed* migration on its short allow-list as rolled back so the next start retries it (only safe for transactional migrations that were fixed after failing — extend the list deliberately, never blindly); (3) `GET /v1/health` (database `SELECT 1`) is Railway's `healthcheckPath`, so a deployment that does not come up healthy never replaces the running one.

**Chapters, page images and the move to R2.** The owner's import page (`/admin/import`) has three steps, all under `v1/catalog/import` and all owner-only (checked against the database):
1. *Catalogue* — tags, teams, series, covers (above).
2. *Storage* — `GET …/storage` reports where new images are written (`database` / `local` / `r2`), whether the four `R2_*` settings exist, and how many images still sit in `image_blobs`; `POST …/storage/copy-to-r2` copies every blob into R2 under the same key, reads each back and compares the bytes, skips what is already there, and never deletes anything. It runs inside the backend, which already holds the R2 credentials, so no one needs the database URL and the R2 keys on their own machine (the script `scripts/migrate-image-blobs-to-r2.ts` remains for a shell). The order is: create the bucket and add the `R2_*` variables → copy → set `IMAGE_STORAGE_BACKEND=r2` → redeploy.
3. *Chapters* — `POST …/legacy/chapters/start` (`LegacyChapterImportService.startJob`) starts the whole import **on the server** and returns at once; `GET …/legacy/chapters/status` reports progress (state, totals, chapters remaining, errors) and the admin page polls it, so nothing depends on a browser tab or a laptop staying awake (a first version that looped from the browser stopped when the laptop slept). The job works in slices of `LEGACY_CHAPTER_BUDGET_MS` (default 90 s) until nothing is left, stops with a reason after two slices that saved nothing, and lives in memory: one run at a time on the instance, a redeploy ends it, and pressing the button again resumes. It reads each imported series' feed and, per chapter, the page list, then stores the pages. It refuses to start unless `IMAGE_STORAGE_BACKEND` is `r2` (or `local` for development): about 2,600 pages must not fill Postgres. A chapter is created unpublished, gets its pages (only the missing ones on a re-run) and is published — with the old release date — only when every page is stored, so an interrupted run never leaves a half-readable chapter and never duplicates. Chapter numbers that already exist in a series (uploaded by hand) are left alone. The old site serves WebP, which is stored byte-for-byte (no second lossy pass); other formats are converted to WebP, and a side longer than WebP can encode is scaled down. The page-image host comes from the old site's own response, so only `lunexteam.com` and its subdomains are accepted. Imported chapters are `manualLock=false` (the old site had none locked). Chapters with no pages on the old site (2 of 194 at the time of writing) are skipped.

## §28 — Visitors without an account browse; members read

The site no longer requires an account to look around. A visitor with none is a **follower**: `src/middleware.ts` (policy in `src/lib/access-policy.ts`) lets them open the browsing pages — home, `/series`, a series' own page, `/search`, `/news`, `/teams` and a team's page, plus the sign-in pages and the rules (`/terms`, `/privacy`) — and, for `GET` only, the data those pages load: the catalogue (`/api/catalog/*` except the owner's `import/*`) and the comment threads (`/api/comments`). Everything else sends them to `/login?next=<where they were going>` (pages) or answers 401 `login_required` (data routes): **reading the chapters themselves** (`/series/<slug>/<chapter>`), commenting, rating, the library, messages, the store, notifications, profiles, team dashboards, `/teams/create` and the admin area. Signing in from a locked page returns the visitor to it (only a path on this site is accepted as `next`). The old `SITE_REQUIRES_LOGIN` switch is gone.

What a follower sees: the header shows *تسجيل الدخول / إنشاء حساب* instead of coins, messages, notifications and the account menu, and a series page swaps the reading, library, comment and rating controls for one line saying they are for members, with the way to sign in (`components/auth/guest-prompt.tsx`). Because the session store only fills in after the page mounts, the root layout hands the signed-in account's id down (`components/session-hint.tsx`) so a member never sees the visitor's controls flash on first paint. `robots.txt` now allows the browsing pages and disallows the account-only ones and the reader; the sitemap lists the catalogue again. Advertising (§31) therefore reaches visitors too, since it runs on exactly these browsing pages.

Limits worth knowing. The gate at the door looks at the session cookies, and a forged cookie would get past it: it is a product rule, not the security boundary. What actually protects things is unchanged and server-side — page images are issued only against a valid access token (§22) and a chapter's lock is enforced where the pages are issued (§33), personal data needs a token, and the backend re-checks roles from the database. The catalogue endpoints (`@Public()`, §27) were always readable by anyone who called them directly.

## §29 — Usernames: length, uniqueness and look-alikes

A username is 3–24 letters, digits and underscores (DTO + `USERNAME_PATTERN`). Two names count as the same when they fold to the same **key** (`modules/users/username.util.ts`): case is ignored, underscores are dropped, and the look-alikes 0/o, 1/l/i and 5/s are one letter — so `Qays`, `qays`, `q_ays` and `QAY5` collide, and `admin` and `Adm1n` are one name. The key lives on the account (`users.usernameKey`, **unique**), so the database refuses a near-duplicate even when two sign-ups arrive together (a unique-violation is turned into the same generic 409). The migration backfills existing accounts with the same folding done in SQL (`translate(lower(username), '01i5_', 'olls')`) and, in a group of look-alikes that already exist, gives the key only to the oldest so it cannot fail on old data; those older near-duplicates keep working and are unprotected only against each other.

Reserved names (`admin`, `owner`, `moderator`, `support`, `system`, ...; compared through the key, so any spelling of them) cannot be taken by sign-up, OAuth-generated names or a rename. The team's own handles are held by **prefix** — anything starting with `lunex` or `ahmedatb` (`Lunex`, `LunexTeam`, `lunex_official`, `AhmedATB`, `ahmed_atb2`, ...); the lists are in `username.util.ts`. Holding a name this way creates no account: nothing to log into, nothing in the member count. An account with the `owner` or `super_administrator` role may take a reserved name by renaming itself (that is how the team claims its handles later); nobody else can, and the unique key still stops anyone from taking a name another account already holds. Only a name that actually changes is checked on a profile save, so an existing account keeps a name it already has. `GET /v1/auth/username-available?username=` (public, not per-IP limited for the reason in §24; one indexed read; usernames are public on profiles anyway) answers `available` or a reason (`invalid` / `reserved` / `taken`) for the sign-up form's live check and suggestions. Registration itself still answers a generic `registration_failed` for any clash so that emails cannot be enumerated.

**Display name.** The sign-up form asks for two names: the *display name* readers see next to comments and on the profile, and the username (the unique handle in the profile URL). The display name is stored in `users.displayName`, is **not** unique (two people may both be "Sara"), and an account without one shows its username. `RegisterDto.displayName` (and `UpdateProfileDto.displayName`, so a rename cannot skip the rules) is trimmed, has runs of whitespace collapsed, and must be 2–40 characters of letters in any script, marks, digits, spaces and `. _ ' -` with at least one letter or digit (`DISPLAY_NAME_PATTERN`, mirrored for the form in `src/lib/display-name.ts`) — no markup, control, zero-width or right-to-left-override characters, which are how a name is made to look like another. Because the display name is what people actually read, it gets the same protection as the handle against passing for the team: `isReservedDisplayName` ignores spaces and punctuation, folds the same look-alikes and also knows the Arabic staff titles and `لونكس`, so `L U N E X`, `LUNEX Admin`, `Adm1n` and `الإدارة` are refused with `409 display_name_reserved` (said plainly, unlike a taken username: it reveals no other account) at sign-up and on a profile save; the owner and super administrators are exempt, as with handles. The field is optional on the API so older clients keep working; the form always sends it.

## §30 — Views, ratings and how the sections are ordered

**Views.** A signed-in reader opening a chapter calls `POST v1/catalog/chapters/:id/view` (the reader page does it once per chapter it shows). The server writes one `chapter_views` row per (chapter, reader, UTC day) — a repeat the same day, or two requests at once, hit the unique index and count nothing — and only a new row adds one to `Chapter.viewCount` and `Series.viewCount`, in one transaction. So a view is "a different reader opened it today", not a page refresh. The rows are what "most read this week" is computed from (`Series.viewsWeek` = rows in the last 7 days, in the catalogue); they are purged after 90 days (`RETENTION_CHAPTER_VIEWS_DAYS`, §20, and the privacy policy says so) while the running totals stay. Views need an account (the site requires one, §28), are not limited per IP (§24) because they are one de-duplicated row, and are in the data export.

**Ratings.** `PUT/DELETE/GET v1/catalog/series/:id/rating` — one 1–5 rating per reader and series (rating again replaces it; 0, 6 or 3.5 are refused). The catalogue carries the average (one decimal) and the count for every series; a rating drops the memoised catalogue at once, so the new average shows on the next render everywhere (cards, home, explore, the series page). The old per-browser rating store is gone — it never reached anyone else. A series nobody has rated shows a dash, not 0.

**Ordering** (`src/lib/ranking.ts`, pure, used by the home sections, the explorer and `getSeriesList`):
- *Most read this week* — `viewsWeek`, ties by rating score, then total views, then most recently updated.
- *Popular* (the default sort; also orders "ongoing", "completed", "recommended" and "featured") — total views weighted 60–100% by the rating score, so a much-read work that readers rate badly slips.
- *Top rated* — the rating pulled toward 3.5 by 5 virtual votes, so one 5-star vote cannot beat hundreds of 4.6s.
- The explorer also offers total views, followers (favorites), latest update and A–Z.

**Staying current.** The server reads the catalogue fresh on every render (the backend keeps it for 15 s), and `CatalogAutoRefresh` on the home page, the explorer and a series page re-renders the page on the server every minute (and when a hidden tab comes back), so numbers and order move without a reload; nothing typed is lost. Checked end to end: views added by other readers changed the "most read this week" order on an open home page within about 90 seconds.

**Reading history.** The library sync (`components/library-sync.tsx`) had a race that lost history: opening a chapter directly (a shared link, a refresh) recorded the chapter locally before the server's copy arrived, and the arriving copy overwrote it, so the chapter never reached the account or the home page's "continue reading". Progress made while the request is in flight, and further than the server knows, is now kept and pushed.

## §31 — Advertising: third-party scripts, consent and where they may run

The site earns its keep from an ad network (three placements from one account: a popunder, a social bar and a smartlink; `src/lib/ads.ts`). Third-party ad code is the largest trust decision on the frontend — it runs with the page's full privileges — so it is confined rather than simply pasted into the layout.

1. **No consent gate — a product decision.** Advertising is the site's revenue, so the popunder and social bar load for every visitor on browsing pages whatever they chose in the cookie banner (the banner governs the site's own storage only, and says so; an earlier draft gated the scripts behind a separate `lunex-consent-ads` cookie and the owner chose to drop it, 2026-09-26). The privacy policy names the network and what it can collect (`/privacy`, "الإعلانات") and tells the visitor how to limit it (browser settings, an ad blocker). Worth knowing: where prior-consent law applies to advertising cookies (EU/UK ePrivacy and GDPR, and similar regimes elsewhere), loading them before consent does not meet it; the exposure is the owner's to weigh, and re-adding a consent tier is a small change (the loader in `components/ads/ad-scripts.tsx` is the only place scripts are injected).
2. **Browsing pages only** (`isAdPage`, an allow-list — anything not listed is protected): home, explorer, a series' page, search, teams and a team's page, news, favourites, terms and privacy. Never sign-in or sign-up (a script there could read a password as it is typed), the account, messages, store and admin/team dashboards, and never the reader: a chapter page is decrypted into a canvas that any script on the page can read, which would bypass the anti-piracy pipeline of §22. A script cannot be unloaded, so navigating from an allowed page to a protected one reloads the document without it (`components/ads/ad-scripts.tsx`).
3. **Scripts are injected by the loader, not written into the layout**, so point 2 holds: the popunder goes into `<head>` and the social bar at the end of `<body>` as the network asks, each once (`data-lunex-ad`).
4. **The smartlink is a link, not a script.** It is shown labelled "رابط إعلاني" (footer, and the "watch an ad" box of a locked chapter) with `rel="sponsored nofollow noopener noreferrer"` and only leaves the site when clicked.
5. **Placed banners.** Three banner zones from the same account — 728×90, 320×50 and 300×250 — are placed by `components/ads/ad-unit.tsx`: the home page (a responsive banner: 728×90 where the screen is at least 800 px wide, 320×50 otherwise, only the one that fits is created) and a series' page (300×250 in the side column). Each runs the network's own snippet, unchanged, in its own small `srcdoc` iframe, so two banners cannot overwrite each other's `atOptions` global. Units are labelled "إعلان", reserve their height (no layout jump), load lazily, render nothing on the server, and appear only on the browsing pages of point 2 — never in the reader. By default the frames are **not** sandboxed (some networks check the site from the frame's referrer and serve nothing to a sandboxed one), so a unit's code has the same reach as the popunder and social bar already have; `NEXT_PUBLIC_ADS_SANDBOX=true` runs them with no access to the page (`allow-scripts allow-popups`), and should be turned back off if they stop filling. **No native widget:** it was tried (2026-09-27) and removed the same day — it draws large picture cards, and what the network served through it was clickbait with photos of women, which is not for this audience. The network's own category filters (adult, dating) are the real remedy for the other formats too; the popunder and social bar are the formats most likely to carry such creatives. `?ads=debug` on any page shows, per unit, whether the network's code was blocked in the visitor's browser or arrived with no ad to give.
6. **Kill switch.** `NEXT_PUBLIC_ADS_ENABLED=false` (frontend build environment) removes all of it — scripts, links and the ad wording — without a code change.

Limits worth knowing. The network's own scripts can set their own cookies and load further code from its own domains; the site cannot inspect or bound that, so a Content-Security-Policy that allow-lists the network's domains is the next hardening step once the domains it uses are known, and a popunder can open a new window on a click (the browser's popup blocker applies). An ad shown to a visitor is chosen by the network, not by the team; the privacy policy says so and gives a way to report one. The registered account's data, reading history and chapter content are never sent to the network by the site.

## §32 — Reader progression: experience, levels, streaks and achievements

Until now a member's level was a constant (level 1, 0/100) and achievements lived in the browser's `localStorage` — nothing could be trusted or shared across devices, and nothing ever moved. It is now server-side (`modules/progress`), decided from what the server itself saw.

**Storage.** Columns on `users` (`xp`, `xpDay`, `xpDayGain`, `chaptersRead`, `streakDays`, `bestStreak`, `streakLastDay`, `achievements text[]`) and `reading_progress.completedThrough`, the highest chapter number the reader has *finished* in a series (separate from `chapterNumber`, the furthest opened). Migration `20260928000000_add_reader_progress` only adds columns with defaults, and marks every chapter before the one a reader is on as already finished, so nobody is paid for reading done before this existed. It is deliberately **not** derived from `chapter_views`: those rows are purged after 90 days (§30, §20), and experience must not shrink; and no per-chapter history is kept beyond the one number per series that `reading_progress` already had.

**Rules** (`progress.util.ts`, pure and tested): finishing a chapter beyond `completedThrough` earns 10; the first finished chapter of a UTC day earns a daily bonus of 10 + 5 per earlier day of the streak (at most 40); a comment earns 5 (the day's first five); a first rating of a series earns 3. **A daily ceiling of 300** caps everything, so no amount of clicking beats a long day of reading. Level *L* is reached at 50·L·(L−1) total experience (100, 300, 600, 1000, … — each level costs 100 more). A streak survives one skipped day's grace (reading yesterday still counts today) and ends after two.

**How a chapter pays** (`POST /v1/me/reading/complete`, the reader sends it when it reaches the end): the server requires a `chapter_views` row for that chapter and reader from today or yesterday (so it was actually opened) that is at least 15 seconds old, moves `completedThrough` forward with a conditional update (two requests cannot both win), then applies the event to the account **under a row lock** (`SELECT … FOR UPDATE`), so simultaneous events cannot both start from the same numbers. The browser only reports "I reached the end"; it never sends an amount. `GET /v1/me/progress` returns the caller's own level, experience, streak, counts and earned achievements (and evaluates achievements, adding ids with an atomic array union — an earned id is never removed). Comments and first ratings award through `ProgressService` from their own services and never fail the comment or rating if the award hiccups.

**Achievements** are defined by id, metric and target in `achievements.defs.ts` (chapters finished, comments, favourites, best streak, level); titles and icons live in the frontend keyed by id.

**Who sees what.** The owner always sees all of it. Other people see level, experience, streak, chapter count and achievements on a profile only if they may see that person's reading history (`historyVisibility`), and the home page's *top readers* — now ranked by experience — lists only accounts whose history is **public**, so a ranking never reveals a number the owner kept private. The account export includes the progression fields; deleting the account removes them with the row.

**Limits worth knowing.** A patient script can still open chapters, wait 15 seconds and finish them, up to the 300/day ceiling; experience has no monetary value here, so the ceiling is the whole defence. Novels are not real backend chapters yet and earn nothing. The chapter lock and the wallet were still client-side when this section was written; they are server-side now (§33).

**Carrying the old numbers over.** The chapter count and achievements the browser used to keep vanished when progression moved to the server, because the server started every account at zero. Migration `20260928120000_backfill_reader_progress` gives back what the server can vouch for: 10 experience per distinct chapter the reader had opened (`chapter_views`) before progression went live (the cut-off is the earlier migration's `finished_at`), with the series' finished-through mark moved up so those chapters cannot pay twice; achievements follow from the counts on the next read. Nothing the browser claims is trusted, so reading done on the old client-only system that never reached the server (a mock chapter, another device) cannot be restored.

## §33 — Locked chapters, reading credits and coins

**What was wrong.** The lock a reader saw was drawn by the browser (the newest three chapters of every series, with coins, tickets and "ad" counters in `localStorage`, editable by anyone); the server did not lock imported chapters at all (`manualLock = false`, because the old site had no locks) and `POST /v1/chapters/:id/unlock` granted an unlock to any signed-in account without checking anything. Tested against a real backend: page tokens for the newest chapter were issued with no unlock, and a single request "unlocked" anything. The lock was decoration.

**What it is now** (`modules/wallet`). The rule is the owner's: a locked chapter is opened either with **reading** or with **money**.
- *Which chapters are locked* (`isLockedByRule`, mirrored in the frontend's `lib/chapter-lock.ts` only to decide what to draw): a staff override (`manualLock`: true = locked, false = open, null = automatic) wins; otherwise the newest `LOCKED_CHAPTER_COUNT` chapters (default 3) of a series are locked, except a series' first `FREE_FIRST_CHAPTERS` (default 3), so a new or short series can always be sampled. Imported chapters follow the same automatic rule (a migration cleared their old "force open").
- *Reading:* every `CHAPTERS_PER_CREDIT` (default 10) chapters a reader finishes — counted by the progression system (§32), so only server-verified, forward, first-time finishes — earn one **unlock credit**.
- *Money:* a chapter costs `CHAPTER_COIN_PRICE` coins (default 50). There is no payment gateway; coins are **added by the owner or a super administrator** (`POST /v1/admin/wallet/grant`) after payment outside the site (Discord), each grant recorded in the append-only `coin_transactions` ledger with who granted it and a note. The store page says so and links to Discord; nothing pretends to be a purchase.
- *Spending:* `POST /v1/chapters/:id/unlock` with `{ method: "credit" | "coins" }` runs as one step under a row lock on the account (`SELECT … FOR UPDATE`): it re-checks the chapter is still unopened, checks the balance, deducts, records the unlock and (for coins) the ledger row together — so two requests at once cannot spend one credit twice or open the same chapter twice for double the price (verified: two simultaneous unlocks with one credit gave one 200 and one 402). A chapter that needs no payment costs nothing; not enough credit or coins answers **402**.
- *Enforcement* is where the pages are issued: `POST /v1/chapters/:id/pages/:n/token` asks the wallet whether this account may read the chapter (free, opened, or staff: uploader, editor, super administrator, owner) and answers 403 `chapter_locked` if not. The lock screen only explains and asks; removing it in the browser gets nothing.
- The frontend reads everything from `GET /v1/me/wallet` (coins, credits, progress toward the next, the configured numbers and the ids of chapters this member has opened), so the two sides cannot drift. The old client economy (`store/rewards.ts`: free starting coins, ticket counters, daily reward, fake purchases) is gone, and with it the ad-watching route to an unlock — advertising is revenue, not currency.
- Staff set a chapter's override on the server (`PATCH /v1/chapters/:id { manualLock }`), no longer in a local store that did nothing real. The owner page *Admin → العملات والقفل* shows the current configuration, grants coins and lists the ledger.

**Migration** `20260929000000_add_wallet`: adds `coins`, `unlockCredits`, `creditProgress` to `users`, `chapter_unlocks.method`, the ledger table, clears the old force-open on imported chapters, and gives readers who already have finished chapters the credits those chapters earned (one per 10).

**Limits worth knowing.** Because the newest chapters of *every* series lock at once, a reader who has read little and has no coins cannot open the latest chapters until they read more (or the next release pushes an older one out of the window); tune `LOCKED_CHAPTER_COUNT` / `CHAPTERS_PER_CREDIT` on Railway if that feels too strict. Novels still earn no credits (they are not real backend chapters yet). Coins are only as trustworthy as the owner's grants; there is no refund path in the application (a mistaken grant is corrected by granting a negative adjustment in the database).

## §34 — Teams: the owner's controls, moving works, adding people directly

**What changed.** The owner (and super administrators / team managers) now run teams from *Admin → الفرق* (`/admin/teams`), and every action there is a real backend call, decided against the account's **current** role (never the token's copy):
- `POST /v1/catalog/series/transfer { seriesIds, teamId }` moves works to a team (empty `teamId` = off every team). Same rule as changing one series' team — global editors only (owner, super administrator, editor). It is one transaction: the series and — when the destination is a team — their **chapters** (`chapters.teamId` records who published each chapter, and the team dashboards and "last active" read it) move together; an unknown series or team changes nothing (404). Audited as `catalog.series_transferred`.
- `POST /v1/catalog/teams/:id/members { username, role }` puts an existing account on a team with no recruitment post (a member already there just gets the new role). Allowed for team managers and for the team's own leader/assistant. `PUT`/`DELETE …/members/:userId` change a role or remove.
- Team settings (`PATCH /teams/:id`: name, description, `recruiting`, and for managers `status` and leader by username), create and delete (a deleted team's series stay, unassigned).
- The admin *السلاسل* page can move one work or a selection to a team; the team dashboard's members tab has the same add-by-username form.

**The "يستقبل طلبات" badge.** It comes from `teams.recruiting`. Opening a position in a team's dashboard now sets that flag on the site (and closing the last open one clears it), so the badge appears on the teams list, the team's page and next to the team on each of its series' pages.

**Known limit — recruitment itself is still browser-local.** Positions and applications are still kept in the visitor's own browser (`store/team-management.ts`), so a reader's application never reaches the team's leader, and the dashboard's member-role and series-edit buttons likewise only change the copy in that browser. Only the operations listed above (team info, status, leader, the recruiting flag, adding members, moving works) reach the site. Making positions and applications real (tables, endpoints, notifications, accept → member) is the next step if teams are to recruit through the site.

## §35 — Notifications: what is written, when, and how it is read

**Kinds** (`notifications.type`): `chapter` (a new chapter of a series the member has in their library), `series` (a new series joined the catalogue), `news` (a post went live), `coins` (the owner added coins), and the account kinds that already existed (`security`, `moderation`, comment removal, team decisions). The notifications page groups them as *الفصول الجديدة / سلاسل جديدة / الأخبار / أخرى*; the same four categories filter `GET /v1/notifications?category=`.

**Who is told.** A chapter notification goes only to accounts that bookmarked the series (and are not banned); a new series and a news post go to every account that is not banned, written by one `INSERT … SELECT` however many accounts there are. They are written by `NotificationsService.chapterPublished / seriesAdded / newsPublished / coinsGranted`, called where the event happens: `ChaptersService.update` when a chapter goes from unpublished to published (never for one already live, and never for the old-site import, which writes chapters directly), `CatalogAdminService.createSeries` and `createNews`/`updateNews` (a draft turning live), `WalletService.grantCoins`. They never throw: a notification failing must not undo the publish that caused it.

**Folding.** Four chapters published together must not be four notifications. `notifications.refId` (the series id) and `notifications.count` let the next chapter of the same series update the member's **unread** row in place — one more chapter, the newest one named ("صدرت 3 فصول جديدة — آخرها الفصل 803"), moved to the top — while a member who already read the last one gets a fresh row. (Verified against Postgres: two chapters → one row, count 2; a third → count 3; after reading, the next starts a new row.)

**Reading.** `GET /v1/notifications` pages newest-first (`limit`, `before` = the last row's time, `hasMore`); `GET /v1/notifications/unread-count` is the bell's number; `PATCH /read-all` takes an optional category. The bell in the header is a link to `/notifications` with the unread count (asked for on load, each minute while the tab is showing, and when it returns); the page shows the periods *اليوم / أمس / هذا الأسبوع / الأسبوع الماضي / هذا الشهر / أقدم*.

**Not built yet.** Members cannot switch a kind off (there is no preference), and there is no email or push delivery: notifications live in the site only.

## §36 — Messages and finding people (server-side, no longer per browser)

**Before.** Chats were kept in each browser's own storage (`store/messages.ts`): a message written on one device never reached the person it was for. They are now real. Tables `conversations`, `conversation_members`, `messages` (migration `20260930140000_add_messaging`); module `modules/messages`, routes under `/v1/conversations`, all needing a signed-in account.

**Who can see what.** A conversation is visible only to its members. Every route is scoped by the id in the caller's token, never an id in the request, and a conversation the caller is not in answers **404** (its existence is not theirs to learn). A direct chat is one row per pair of people (`pairKey = "<smaller id>:<larger id>"`, unique), so starting a chat with someone you already talk to opens the existing one; a group has 3–20 people, an optional title, and only its creator can add people. Anyone can leave; a conversation with nobody left is deleted.

**Sending.** Text of 1–2000 characters, 30 a minute per account; a banned account is refused and a **muted** (timeout) account cannot send — this closes the gap the old `use-mute-status` comment described ("messages are still device-local"), because the server now enforces it. Unread is computed from the member's `lastReadAt` (everything by others after it); a sender's own message moves their `lastReadAt`. The page polls (list every 10 s, the open chat every 4 s, the header badge every 30 s) — there are no push connections yet.

**Finding people.** `GET /v1/users/search?q=` (any signed-in member) returns up to 30 accounts whose username or display name contains the text — exact matches first, then prefixes — with only what already shows beside every comment (name, username, picture); banned accounts never appear and a leading "@" is ignored. The site search's members tab and the new-chat picker (type a name, pick one person or several) use it. The search used to look only at the people the catalogue knows (those on a team), which is why a copied username found nothing.

**Not built yet.** Message deletion and editing, blocking, attachments, and notifications for messages (the unread number is the only signal).
