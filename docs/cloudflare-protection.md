# Cloudflare protection

## Who controls what (as found on 2026-09-25)

- The **registrar** account (Spaceship) belongs to the site's owner; the domain was registered 2026-02-23 and renews 2027-02-23.
- The **DNS zone** on Cloudflare (nameservers `julian` / `eloise`) belongs to *another person's* Cloudflare account, with whom there is no contact. That account runs the old site. So `protect.mjs` cannot be run against the live zone from the owner's own account (its zone list is empty, which is why "Specific zone" is greyed out when creating a token).
- Because the owner controls the registrar, the owner can move the zone to their own Cloudflare account by changing the nameservers at Spaceship. **That switch takes the old site offline** — its DNS records live in the other account — so it is the cutover itself, not a settings tweak. Do not change nameservers before the steps under "At cutover" are ready. The change is not instant either: the `.com` delegation is cached for up to 48 hours, so the switch and any rollback (setting the old nameservers back, possible as long as the other account keeps its zone) take effect gradually.

## Where things stand

`lunexteam.com`, `www.lunexteam.com` and `cdn.lunexteam.com` are already on Cloudflare (proxied) — but they still serve the **old** site. The new site lives on Railway (`lunexteam-production.up.railway.app`) and is not behind Cloudflare until the domain is pointed at it. So protection has two phases:

1. **Now, on the existing zone** — safe connection settings, a few rules, and an *API lane* that keeps servers able to read the old site (`/api/v2/...`) and its image CDN, which the owner's import uses until the old site is retired.
2. **At cutover** — when the domain is pointed at Railway, the same rules protect the new site (sign-in flood control, covers cached at the edge), plus the extra steps below.

## Running it

The script changes your live domain, so **you** run it, with a token that stays on your machine.

1. Cloudflare dashboard → My Profile → API Tokens → Create Token → *Custom token*, limited to the `lunexteam.com` zone:
   `Zone · Zone Settings · Edit`, `Zone · Zone WAF · Edit`, `Zone · Cache Rules · Edit`, `Zone · Zone · Read`.
2. See what it would change (changes nothing):
   ```bash
   CLOUDFLARE_API_TOKEN=<token> node infra/cloudflare/protect.mjs
   ```
3. Apply:
   ```bash
   CLOUDFLARE_API_TOKEN=<token> node infra/cloudflare/protect.mjs --apply
   ```
   It is safe to repeat. It only touches the settings below and the rules whose description starts with `lunex:`; your other rules stay where they are. Tests: `node --test infra/cloudflare/protect.test.mjs` (they run against a local stand-in, no token needed).

## What it sets

| What | Value | Why |
|---|---|---|
| Always Use HTTPS, automatic HTTPS rewrites | on | nothing should be reachable in the clear |
| Minimum TLS, TLS 1.3 | 1.2, on | drops obsolete clients |
| Browser Integrity Check, Security Level | on, medium | Cloudflare's own default screening |
| WAF rule 1 — **API lane** (skip) | `lunexteam.com/api/v2/*`, `cdn.lunexteam.com`, and `--api-host` if given | servers (the import, tools, bots) are never challenged; listed first so it wins |
| WAF rule 2 — block probes | paths containing `/.env`, `/.git/`, `/wp-admin`, `/xmlrpc.php`, `/phpmyadmin`, … | scanners looking for files that do not exist here |
| Rate limit | `POST /api/auth/login` and `/api/auth/register`: 6 per 10 s per IP on Free (20 per 60 s on paid) | stops floods before they reach the origin; the site's proof-of-work already makes each attempt cost CPU |
| Cache rule | series covers, banners, team logos, news covers | their URLs carry a version, so the edge may keep them |

Not done unless you ask:

- `--strict-ssl` sets SSL mode to *Full (strict)*. Only do it when the origin has a valid certificate (Railway's does; check the old origin first).
- `--hsts` sends `Strict-Transport-Security` (6 months, no subdomains, no preload). Hard to undo for visitors, so it is opt-in.
- `--bot-fight` turns on Bot Fight Mode. **Left off on purpose**: on the Free plan it cannot be exempted by a rule, so it would block the API lane too (and the import). Turn it on only after the import is finished, or once the API lives on a hostname that is not proxied.

## The API lane

Cloudflare's checks are built for browsers; a server calling an API cannot solve a challenge. The lane is a WAF *skip* rule that turns off the rate limit, managed rules, Browser Integrity Check, UA blocking and Security Level for exactly the hosts and paths servers use. It does not weaken the sign-in pages: those are not in the lane. Our own backend is unaffected either way — the frontend reaches it directly on Railway, and it has its own guards (per-account rate limits, proof-of-work, roles checked in the database, the service key for the bot).

## At cutover (pointing lunexteam.com at Railway)

1. Railway → frontend service → Settings → Networking → add the custom domain `lunexteam.com`; Cloudflare DNS → `CNAME` to the value Railway shows, **proxied** (orange cloud).
2. Set SSL mode to *Full (strict)* (`--strict-ssl`).
3. Set `FRONTEND_URL` and `CORS_ORIGINS` on the backend to `https://lunexteam.com`; add `https://lunexteam.com/api/auth/callback/discord` and `.../google` as redirect URIs at Discord and Google (§ OAuth in the architecture doc).
4. Behind Cloudflare, the visitor's address arrives in `CF-Connecting-IP`, and the frontend takes it (`src/lib/client-ip.ts`) **only** when the request also carries `x-lunex-edge` equal to its `CF_EDGE_SECRET` — otherwise anyone could send the header straight to the Railway address and pick their own address. So: (a) generate a secret (`openssl rand -base64 32`) and set it as `CF_EDGE_SECRET` on the frontend service; (b) Cloudflare → Rules → Transform Rules → *Modify Request Header* → *Set static* `x-lunex-edge` = that secret, for all incoming requests. Also set `BFF_SHARED_KEY` (one random value) on **both** the frontend and backend services — that is what makes the backend rate-limit per visitor at all (security architecture §14). **Update (cutover, 2026-09-26):** this turned out to be optional. Behind Cloudflare, Railway's edge already sets `X-Real-IP` to the visitor's own address (it reads Cloudflare's header itself), and it discards a made-up `X-Real-IP`/`X-Forwarded-For` sent by a visitor — checked both through `lunexteam.com` and straight at the Railway address. So the frontend's `X-Real-IP` rule is enough and neither `CF_EDGE_SECRET` nor the Transform Rule is needed; they only matter if the site ever runs somewhere that does not set `X-Real-IP` this way. Check with `GET https://lunexteam.com/api/auth/client` — it should show the visitor's own address and `verified: true`.
5. If you keep an API hostname behind Cloudflare, pass it as `--api-host api.lunexteam.com` so it joins the lane.
6. Remove the old site's DNS records and the lane rule for `/api/v2/` once the import is done and the old site is gone.

## Doing it by hand instead

Everything above maps to the dashboard: *SSL/TLS → Edge Certificates* (HTTPS, TLS), *Security → WAF → Custom rules* (skip rule first, then block), *Security → WAF → Rate limiting rules*, *Caching → Cache Rules*. Keep the skip rule at the top of the custom rules list.
