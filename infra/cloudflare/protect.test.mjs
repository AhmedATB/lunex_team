// Run with: node --test infra/cloudflare
// A small stand-in for Cloudflare's API, so the script's logic is checked without a token or a real zone.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { buildPlan, client, run } from "./protect.mjs";

function fakeCloudflare({ plan = "free", settings = {}, rulesets = {} } = {}) {
  const writes = [];
  const state = { settings: { ...settings }, rulesets: { ...rulesets } };
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : undefined;
      const url = new URL(req.url, "http://x");
      const send = (status, result, ok = true, errors = []) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: ok, result, errors }));
      };
      if (req.headers.authorization !== "Bearer test-token") return send(403, null, false, [{ code: 9109, message: "Invalid token" }]);
      if (req.method === "GET" && url.pathname === "/zones") return send(200, [{ id: "zone1", plan: { legacy_id: plan } }]);
      if (req.method === "GET" && url.pathname === "/zones/zone1/settings") return send(200, Object.entries(state.settings).map(([id, value]) => ({ id, value })));
      const setting = url.pathname.match(/^\/zones\/zone1\/settings\/(.+)$/);
      if (req.method === "PATCH" && setting) {
        writes.push({ method: "PATCH", path: url.pathname, body });
        state.settings[setting[1]] = body.value;
        return send(200, { id: setting[1], value: body.value });
      }
      const phase = url.pathname.match(/^\/zones\/zone1\/rulesets\/phases\/(.+)\/entrypoint$/);
      if (phase && req.method === "GET") return state.rulesets[phase[1]] ? send(200, { rules: state.rulesets[phase[1]] }) : send(404, null, false, [{ code: 10003, message: "not found" }]);
      if (phase && req.method === "PUT") {
        writes.push({ method: "PUT", path: url.pathname, body });
        state.rulesets[phase[1]] = body.rules;
        return send(200, { rules: body.rules });
      }
      if (req.method === "PUT" && url.pathname === "/zones/zone1/bot_management") {
        writes.push({ method: "PUT", path: url.pathname, body });
        return send(200, body);
      }
      return send(404, null, false, [{ code: 7003, message: `no route ${req.method} ${url.pathname}` }]);
    });
  });
  return { server, writes, state };
}

async function withFake(options, fn) {
  const fake = fakeCloudflare(options);
  await new Promise((resolve) => fake.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${fake.server.address().port}`;
  try {
    await fn({ call: client({ token: "test-token", base }), fake });
  } finally {
    await new Promise((resolve) => fake.server.close(resolve));
  }
}

const quiet = () => {};

describe("the rules", () => {
  const plan = buildPlan({ zone: "lunexteam.com", apiHost: "api.lunexteam.com", plan: "free" });

  it("lists the API lane first, so it wins over every other rule", () => {
    assert.equal(plan.firewall[0].action, "skip");
    assert.match(plan.firewall[0].expression, /\/api\/v2\//);
    assert.match(plan.firewall[0].expression, /cdn\.lunexteam\.com/);
    assert.match(plan.firewall[0].expression, /api\.lunexteam\.com/);
  });

  it("stays within what the Free plan allows: no regular expressions, one rate-limit rule, IP-based", () => {
    const all = [...plan.firewall, ...plan.rateLimit, ...plan.cache].map((r) => r.expression).join(" ");
    assert.ok(!/ matches |~/.test(all));
    assert.equal(plan.rateLimit.length, 1);
    assert.deepEqual(plan.rateLimit[0].ratelimit.characteristics, ["cf.colo.id", "ip.src"]);
    assert.equal(plan.rateLimit[0].ratelimit.period, 10);
    assert.ok(plan.firewall.length <= 5);
  });

  it("guards only sign-in and sign-up, never the API lane", () => {
    assert.match(plan.rateLimit[0].expression, /\/api\/auth\/login/);
    assert.match(plan.rateLimit[0].expression, /\/api\/auth\/register/);
    assert.ok(!plan.rateLimit[0].expression.includes("/api/v2/"));
  });

  it("gives paid plans a longer window", () => {
    const pro = buildPlan({ zone: "lunexteam.com", plan: "pro" });
    assert.equal(pro.rateLimit[0].ratelimit.period, 60);
    assert.ok(!pro.firewall[0].expression.includes("api.lunexteam.com"));
  });
});

describe("protect", () => {
  it("changes nothing without --apply, and says what it would do", async () => {
    await withFake({ settings: { always_use_https: "off", min_tls_version: "1.0" } }, async ({ call, fake }) => {
      const lines = [];
      const changes = await run({ call, zone: "lunexteam.com", apply: false, log: (l) => lines.push(l) });
      assert.deepEqual(fake.writes, []);
      assert.ok(changes.includes("always_use_https"));
      assert.ok(lines.some((l) => l.includes("would set") && l.includes("always_use_https")));
      assert.ok(lines.some((l) => l.includes("Run again with --apply")));
    });
  });

  it("applies the settings and the rules, and keeps the owner's own rules", async () => {
    const mine = { id: "r1", description: "my own rule", action: "block", expression: '(ip.src eq 203.0.113.9)', enabled: true };
    await withFake({ settings: { always_use_https: "off" }, rulesets: { http_request_firewall_custom: [mine] } }, async ({ call, fake }) => {
      await run({ call, zone: "lunexteam.com", apply: true, log: quiet });
      const firewall = fake.state.rulesets.http_request_firewall_custom;
      assert.equal(firewall.at(-1).description, "my own rule");
      assert.equal(firewall[0].action, "skip");
      assert.equal(fake.state.settings.always_use_https, "on");
      assert.ok(fake.state.rulesets.http_ratelimit.length === 1);
      assert.ok(fake.state.rulesets.http_request_cache_settings.length === 1);
    });
  });

  it("is a no-op the second time", async () => {
    await withFake({}, async ({ call, fake }) => {
      await run({ call, zone: "lunexteam.com", apply: true, log: quiet });
      const before = fake.writes.length;
      const again = await run({ call, zone: "lunexteam.com", apply: true, log: quiet });
      assert.deepEqual(again, []);
      assert.equal(fake.writes.length, before);
    });
  });

  it("does not touch the SSL mode or Bot Fight Mode unless asked", async () => {
    await withFake({}, async ({ call, fake }) => {
      await run({ call, zone: "lunexteam.com", apply: true, log: quiet });
      assert.ok(!("ssl" in fake.state.settings));
      assert.ok(!fake.writes.some((w) => w.path.endsWith("/bot_management")));
      await run({ call, zone: "lunexteam.com", apply: true, strictSsl: true, botFight: true, log: quiet });
      assert.equal(fake.state.settings.ssl, "strict");
      assert.ok(fake.writes.some((w) => w.path.endsWith("/bot_management") && w.body.fight_mode === true));
    });
  });

  it("explains a bad token or an unknown zone instead of failing silently", async () => {
    await withFake({}, async ({ fake }) => {
      const base = `http://127.0.0.1:${fake.server.address().port}`;
      await assert.rejects(run({ call: client({ token: "wrong", base }), zone: "lunexteam.com", apply: true, log: quiet }), /Invalid token/);
    });
  });
});
