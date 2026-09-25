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
| `image_assets` / `image_access_log` | The watermarked-image pipeline (§9–§11). |
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

## §11 — Image serving: watermark, tiling/encryption, and anti-scraping

`ImagesService.streamAsset()` re-encodes every served image with a tiled, semi-transparent SVG watermark before slicing and encrypting it — see §21 for the full pipeline (this section predates that work and originally described a plain watermarked PNG response; it no longer returns that). The watermark itself carries the requesting user's id and a per-token session nonce (never just a timestamp — two page loads by the same user now carry visibly distinct marks), repeated across the image so cropping can't remove every copy. This is framed honestly in the code as **deterrence through traceability, not prevention** — anything that has to render onto a screen a human can see can be re-photographed; the point is that a leaked page still carries enough signal to trace which session leaked it.

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

**Serving** (`ImagesService.streamAsset`, unchanged token verification, new payload): loads the real image bytes → watermarks (per-session now, §11) → `buildTileBundle()` (`tiling/tile-bundle.util.ts`) slices it into an adaptive grid (`Math.round(dimension / 650px)`, clamped 2×2..5×5 — never a blind fixed count that would blow up request/CPU cost on a huge page) → shuffles the tiles into random send order → serializes one plaintext payload (`[4-byte manifest length][manifest JSON][tile bytes concatenated in that same shuffled order]`) → `encryptBundle()` AES-256-GCM-encrypts the whole thing with the token's own `bundleKey` (§9), wire format `[12-byte IV][ciphertext][16-byte tag]`. The HTTP response is `application/octet-stream` — opaque bytes, never a directly-openable image, closing the gap the old plain-PNG response had (anyone could see and re-open the real image URL in DevTools' Network tab; now they'd see the real *request* but the *response* is useless without the one-time key that already left with the (expired, single-use) token).

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

**Known limitation.** The BFF does not forward the visitor's IP, so the backend's per-IP throttler (`@Throttle`, default 120/min) sees every visitor as the BFF and shares one budget across all users. It predates this section but matters more now that every chapter read produces a progress write; fixing it means forwarding the client IP and configuring `trust proxy` deliberately (the backend must not be reachable by anything that could spoof the header).

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
