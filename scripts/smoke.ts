/**
 * Post-deploy smoke test.
 *
 *   npm run smoke                              # http://localhost:3000
 *   npm run smoke -- https://cheki.et          # any base URL
 *   SMOKE_BASE_URL=https://cheki.et npm run smoke
 *
 * Checks the pages people land on, the API health route, that a bad
 * /api/verify request gets a clean 4xx (never "verified"), and that an old
 * /verify URL still 301s to its bank page. Exits 1 if any check fails, so a
 * deploy script can roll back on a non-zero exit. See docs/RELEASING.md.
 *
 * It sends no real receipt references and makes at most two /api/verify
 * requests, so it is safe to run against production.
 */

type Check = { name: string; run: (base: string) => Promise<string | void> };

const TIMEOUT_MS = 30_000;
const UA = "cheki-smoke/1 (+https://github.com/1RB/cheki)";

function arg(): string {
  const fromArgv = process.argv.slice(2).find((a) => /^https?:\/\//i.test(a));
  const raw = fromArgv ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
  const u = new URL(raw);
  return u.origin;
}

async function get(base: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(new URL(path, base), {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
    headers: { "User-Agent": UA, ...(init.headers ?? {}) },
  });
}

function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function page(path: string, mustContain: RegExp): Check {
  return {
    name: `GET ${path} → 200 HTML`,
    run: async (base) => {
      const r = await get(base, path);
      expect(r.status === 200, `status ${r.status}`);
      expect((r.headers.get("content-type") ?? "").includes("text/html"), `content-type ${r.headers.get("content-type")}`);
      const body = await r.text();
      expect(mustContain.test(body), `body does not match ${mustContain}`);
      return `${body.length} bytes`;
    },
  };
}

/** A bad request must be refused, and must never look like a verified receipt. */
function badVerify(name: string, body: string): Check {
  return {
    name,
    run: async (base) => {
      const r = await get(base, "/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await r.text();
      let json: Record<string, unknown> | undefined;
      try {
        json = JSON.parse(text);
      } catch {
        // checked below
      }
      expect(r.status >= 400 && r.status < 500, `status ${r.status} (want 4xx): ${text.slice(0, 200)}`);
      expect(json && typeof json === "object", `not JSON: ${text.slice(0, 200)}`);
      expect(json.success !== true, `success is true: ${text.slice(0, 200)}`);
      expect(json.verified !== true, `verified is true: ${text.slice(0, 200)}`);
      expect(!/"verified"\s*:\s*true/.test(text), "body contains verified:true");
      return `${r.status} ${String(json.error ?? "").slice(0, 80)}`;
    },
  };
}

const checks: Check[] = [
  page("/", /cheki/i),
  page("/banks/cbe", /CBE|Commercial Bank of Ethiopia/i),
  page("/status", /status/i),
  page("/endpoints", /endpoint/i),
  page("/about", /Ray \(/),
  {
    name: "GET /api/health → 200 JSON",
    run: async (base) => {
      const r = await get(base, "/api/health");
      expect(r.status === 200, `status ${r.status}`);
      const json = (await r.json()) as { status?: string; banks?: unknown[] };
      expect(json.status === "ok", `status field ${JSON.stringify(json.status)}`);
      expect(Array.isArray(json.banks) && json.banks.length > 0, "no banks in health body");
      return `${json.banks.length} banks`;
    },
  },
  badVerify("POST /api/verify bad reference → 4xx, not verified", JSON.stringify({ bank: "cbe", reference: "../../etc/passwd" })),
  badVerify("POST /api/verify non-object body → 4xx, not verified", "[]"),
  {
    name: "GET old /verify URL → 301 to /banks/cbe",
    run: async (base) => {
      const r = await get(base, "/verify/verify-cbe-receipt-online");
      expect(r.status === 301, `status ${r.status} (want 301)`);
      const loc = r.headers.get("location") ?? "";
      expect(new URL(loc, base).pathname === "/banks/cbe", `location ${loc}`);
      return loc;
    },
  },
  {
    name: "GET consolidated /verify URL → one 301 to its section",
    run: async (base) => {
      const r = await get(base, "/verify/fake-cbe-receipt-detection");
      expect(r.status === 301, `status ${r.status} (want 301)`);
      const loc = new URL(r.headers.get("location") ?? "", base);
      expect(loc.pathname === "/banks/cbe" && loc.hash === "#fake-receipt", `location ${loc}`);
      const next = await get(base, loc.pathname);
      expect(next.status === 200, `destination status ${next.status} (want 200, no chain)`);
      return `${loc.pathname}${loc.hash}`;
    },
  },
];

async function main() {
  const base = arg();
  console.log(`cheki smoke test against ${base}\n`);
  let failed = 0;
  for (const c of checks) {
    const t0 = Date.now();
    try {
      const note = await c.run(base);
      console.log(`  PASS  ${c.name}  (${Date.now() - t0} ms${note ? `, ${note}` : ""})`);
    } catch (e) {
      failed++;
      console.log(`  FAIL  ${c.name}  (${Date.now() - t0} ms): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
}

main();
