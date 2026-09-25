#!/usr/bin/env node
/**
 * Turns on the protection layer for the lunexteam.com zone, through Cloudflare's API.
 *
 *   CLOUDFLARE_API_TOKEN=<token> node infra/cloudflare/protect.mjs            # shows what it would change
 *   CLOUDFLARE_API_TOKEN=<token> node infra/cloudflare/protect.mjs --apply    # changes it
 *
 * Run it yourself: the token can change your live domain, so it should never leave your machine.
 * Create it at dash.cloudflare.com -> My Profile -> API Tokens -> Create Token -> Custom, scoped to this zone only:
 *   Zone > Zone Settings > Edit,  Zone > Zone WAF > Edit,  Zone > Cache Rules > Edit,  Zone > Zone > Read
 * (add Zone > Bot Management > Edit only if you use --bot-fight).
 *
 * Safe to run again: it only touches the settings and the rules whose description starts with "lunex:", and leaves
 * every other rule of yours where it is. Nothing here changes the SSL mode or turns on Bot Fight Mode unless asked.
 *
 * The API lane. Two things read this zone from servers, not browsers, and must not be challenged:
 *   - the old site's public API (lunexteam.com/api/v2/...) and its image CDN (cdn.lunexteam.com), which the owner's
 *     import reads from our backend until the old site is retired;
 *   - later, our own API hostname if one is put behind Cloudflare (set --api-host).
 * The first WAF rule skips every other security feature for those, and it is listed before the rest so it wins.
 * Bot Fight Mode is deliberately off by default: on the Free plan it cannot be skipped by a rule, so turning it on
 * would block that lane too.
 */
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const PREFIX = "lunex:";

/** Zone settings that are safe on any live site: they change how visitors connect, not what the origin has to support. */
export const SAFE_SETTINGS = [
  { id: "always_use_https", value: "on" },
  { id: "min_tls_version", value: "1.2" },
  { id: "tls_1_3", value: "on" },
  { id: "automatic_https_rewrites", value: "on" },
  { id: "browser_check", value: "on" },
  { id: "security_level", value: "medium" },
];

export function buildPlan({ zone, apiHost, plan }) {
  const web = `http.host in {"${zone}" "www.${zone}"}`;
  const lane = [
    // the old site's API and CDN
    `(${web} and starts_with(http.request.uri.path, "/api/v2/"))`,
    `(http.host eq "cdn.${zone}")`,
    // our own API hostname, once it sits behind Cloudflare
    apiHost && `(http.host eq "${apiHost}")`,
  ].filter(Boolean);

  const free = plan === "free";
  return {
    firewall: [
      {
        description: `${PREFIX} let servers read the old site's API and CDN (the import) and our API host`,
        action: "skip",
        expression: lane.join(" or "),
        action_parameters: {
          ruleset: "current",
          phases: ["http_ratelimit", "http_request_firewall_managed"],
          products: ["bic", "hot", "securityLevel", "uaBlock", "waf", "zoneLockdown"],
        },
        logging: { enabled: true },
        enabled: true,
      },
      {
        description: `${PREFIX} block scans for files and admin panels that do not exist here`,
        action: "block",
        expression: [
          "/.env",
          "/.git/",
          "/.aws/",
          "/wp-admin",
          "/wp-login",
          "/xmlrpc.php",
          "/phpmyadmin",
          "/cgi-bin/",
        ]
          .map((part) => `(http.request.uri.path contains "${part}")`)
          .join(" or "),
        enabled: true,
      },
    ],
    // Sign-in and sign-up are the endpoints worth guarding against floods; the site's own proof-of-work already
    // makes each attempt cost CPU, this stops the flood before it reaches the origin.
    rateLimit: [
      {
        description: `${PREFIX} slow down floods of sign-in and sign-up attempts`,
        action: "block",
        expression: `(${web} and http.request.method eq "POST" and http.request.uri.path in {"/api/auth/login" "/api/auth/register"})`,
        ratelimit: {
          characteristics: ["cf.colo.id", "ip.src"],
          period: free ? 10 : 60,
          requests_per_period: free ? 6 : 20,
          mitigation_timeout: free ? 10 : 300,
        },
        enabled: true,
      },
    ],
    // Covers never change under the same URL (the address carries a version), so the edge may keep them.
    cache: [
      {
        description: `${PREFIX} let the edge keep series covers, banners and logos`,
        action: "set_cache_settings",
        // starts_with / ends_with only: regular expressions in rules need a paid plan.
        expression:
          `(${web}) and (` +
          [
            `(starts_with(http.request.uri.path, "/api/catalog/series/") and (ends_with(http.request.uri.path, "/cover") or ends_with(http.request.uri.path, "/banner")))`,
            `(starts_with(http.request.uri.path, "/api/catalog/teams/") and ends_with(http.request.uri.path, "/logo"))`,
            `(starts_with(http.request.uri.path, "/api/catalog/news/") and ends_with(http.request.uri.path, "/cover"))`,
          ].join(" or ") +
          `)`,
        action_parameters: { cache: true, edge_ttl: { mode: "respect_origin" }, browser_ttl: { mode: "respect_origin" } },
        enabled: true,
      },
    ],
  };
}

const PHASES = { firewall: "http_request_firewall_custom", rateLimit: "http_ratelimit", cache: "http_request_cache_settings" };

/** Talks to Cloudflare. `base` is overridable so the logic can be tested against a local stand-in. */
export function client({ token, base = "https://api.cloudflare.com/client/v4", fetchImpl = fetch }) {
  return async function call(method, path, body) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (res.status === 404 && method === "GET") return null;
    if (!res.ok || !json?.success) {
      const detail = (json?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${res.status}`;
      throw new Error(`${method} ${path} -> ${detail}`);
    }
    return json.result;
  };
}

export async function run({ call, zone, apply, apiHost, hsts = false, strictSsl = false, botFight = false, log = console.log }) {
  const changes = [];
  const say = (line) => log(line);

  const zones = await call("GET", `/zones?name=${encodeURIComponent(zone)}`);
  if (!zones?.length) throw new Error(`The token cannot see a zone named ${zone}. Check the name and the token's zone scope.`);
  const { id, plan } = { id: zones[0].id, plan: zones[0].plan?.legacy_id ?? "free" };
  say(`Zone ${zone} (${id}), plan: ${plan}. Mode: ${apply ? "APPLY" : "dry run (nothing is changed)"}\n`);

  // ---- zone settings
  const current = new Map((await call("GET", `/zones/${id}/settings`)).map((s) => [s.id, s.value]));
  const desired = [...SAFE_SETTINGS];
  if (strictSsl) desired.push({ id: "ssl", value: "strict" });
  if (hsts) {
    desired.push({
      id: "security_header",
      value: { strict_transport_security: { enabled: true, max_age: 15552000, include_subdomains: false, preload: false, nosniff: true } },
    });
  }
  for (const setting of desired) {
    if (JSON.stringify(current.get(setting.id)) === JSON.stringify(setting.value)) {
      say(`  ok      ${setting.id} already ${JSON.stringify(setting.value)}`);
      continue;
    }
    say(`  ${apply ? "set    " : "would set"} ${setting.id}: ${JSON.stringify(current.get(setting.id))} -> ${JSON.stringify(setting.value)}`);
    changes.push(setting.id);
    if (apply) await call("PATCH", `/zones/${id}/settings/${setting.id}`, { value: setting.value });
  }

  if (botFight) {
    say(`  ${apply ? "set    " : "would set"} bot_management.fight_mode: true   (blocks servers too: the API lane is NOT exempt from this)`);
    changes.push("bot_fight_mode");
    if (apply) await call("PUT", `/zones/${id}/bot_management`, { fight_mode: true });
  } else {
    say("  skipped Bot Fight Mode (it cannot be exempted on the Free plan, so it would block the API lane; use --bot-fight to turn it on anyway)");
  }

  // ---- rules
  const wanted = buildPlan({ zone, apiHost, plan });
  for (const [key, phase] of Object.entries(PHASES)) {
    const entry = await call("GET", `/zones/${id}/rulesets/phases/${phase}/entrypoint`);
    const others = (entry?.rules ?? []).filter((rule) => !rule.description?.startsWith(PREFIX));
    const ours = wanted[key];
    const previous = (entry?.rules ?? []).filter((rule) => rule.description?.startsWith(PREFIX));
    const same =
      previous.length === ours.length &&
      ours.every((rule, i) => previous[i].expression === rule.expression && previous[i].action === rule.action && previous[i].description === rule.description);
    say(`\n  ${phase}: ${ours.length} rule(s) of ours, ${others.length} of yours left alone${same ? " (already in place)" : ""}`);
    for (const rule of ours) say(`    - [${rule.action}] ${rule.description}`);
    if (same) continue;
    changes.push(phase);
    if (apply) await call("PUT", `/zones/${id}/rulesets/phases/${phase}/entrypoint`, { rules: [...ours, ...others] });
  }

  say(
    changes.length === 0
      ? "\nNothing to change."
      : apply
        ? `\nDone: ${changes.length} change(s) applied.`
        : `\n${changes.length} change(s) pending. Run again with --apply to make them.`
  );
  return changes;
}

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      zone: { type: "string", default: "lunexteam.com" },
      "api-host": { type: "string" },
      hsts: { type: "boolean", default: false },
      "strict-ssl": { type: "boolean", default: false },
      "bot-fight": { type: "boolean", default: false },
    },
  });
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.error("Set CLOUDFLARE_API_TOKEN first (see the comment at the top of this file for the permissions it needs).");
    process.exit(1);
  }
  const call = client({ token, base: process.env.CLOUDFLARE_API_BASE });
  await run({
    call,
    zone: values.zone,
    apply: values.apply,
    apiHost: values["api-host"],
    hsts: values.hsts,
    strictSsl: values["strict-ssl"],
    botFight: values["bot-fight"],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`\nFailed: ${err.message}`);
    process.exit(1);
  });
}
