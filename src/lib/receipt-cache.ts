/**
 * In-memory receipt cache for /api/verify.
 *
 * Receipts are immutable facts: once a bank has published a receipt for a
 * reference, the amount, names and date never change. Re-fetching it costs a
 * round trip to a bank endpoint that may be slow, rate-limited, or geo-blocked,
 * so repeat checks are served from memory instead.
 *
 * Deliberately pulls in no third-party dependency. cheki must stay runnable
 * with `docker-compose up` and free on a serverless host, so this is a plain
 * per-process Map — not Redis, not a database. It warms per instance and
 * resets on cold start, which is the right trade for an immutable-value cache:
 * losing it costs one extra bank fetch, never correctness.
 *
 * Failures are never cached. A timeout, a geo-block, or an unparseable receipt
 * must retry against the live endpoint next time.
 */

import { detectBankFromUrl, isUrl } from "./adapters/url-detector";

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — covers a business day
const DEFAULT_MAX_ENTRIES = 1000;

interface CacheEntry {
  value: Record<string, unknown>;
  expiresAt: number;
}

interface CacheStore {
  map: Map<string, CacheEntry>;
  hits: number;
  misses: number;
  evictions: number;
}

/** Survive Next.js dev HMR and duplicated module instances. */
const globalStore = globalThis as unknown as { __chekiReceiptCache?: CacheStore };

function store(): CacheStore {
  if (!globalStore.__chekiReceiptCache) {
    globalStore.__chekiReceiptCache = { map: new Map(), hits: 0, misses: 0, evictions: 0 };
  }
  return globalStore.__chekiReceiptCache;
}

function ttlMs(): number {
  const raw = process.env.CHEKI_CACHE_TTL_MS;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_TTL_MS;
}

function maxEntries(): number {
  const raw = process.env.CHEKI_CACHE_MAX_ENTRIES;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_MAX_ENTRIES;
}

function cacheEnabled(): boolean {
  return process.env.CHEKI_CACHE !== "off";
}

/**
 * Key for one verification. Everything the verifier reads must be part of it,
 * or two different receipts could collide.
 */
export function cacheKeyFor(input: {
  bank?: string;
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  qrData?: string;
}): string {
  return [
    (input.bank ?? "").trim().toLowerCase(),
    (input.reference ?? "").trim(),
    (input.accountNumber ?? "").trim(),
    (input.phoneNumber ?? "").trim(),
    (input.qrData ?? "").trim(),
  ].join("|");
}

/**
 * Cache key for an incoming API body.
 *
 * The verifier rewrites a receipt URL into (bank, reference, accountNumber,
 * phoneNumber) before fetching, so the key has to mirror that rewrite.
 * Otherwise the same URL pasted with a different pre-selected bank would miss
 * the cache every time, and the point of caching is precisely that it does not.
 */
export function verificationCacheKey(input: {
  bank?: string;
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  qrData?: string;
}): string {
  const normalized = { ...input };
  const ref = (input.reference ?? "").trim();
  if (ref && isUrl(ref)) {
    const detected = detectBankFromUrl(ref);
    if (detected) {
      normalized.bank = detected.bank;
      normalized.reference = detected.reference;
      if (detected.accountNumber && !input.accountNumber) {
        normalized.accountNumber = detected.accountNumber;
      }
      if (detected.phoneNumber && !input.phoneNumber) {
        normalized.phoneNumber = detected.phoneNumber;
      }
    }
  }
  return cacheKeyFor(normalized);
}

/** Returns a copy of the cached payload, or undefined on miss/expiry. */
export function getCached(key: string): Record<string, unknown> | undefined {
  const s = store();
  const entry = s.map.get(key);
  if (!entry) {
    s.misses += 1;
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    s.map.delete(key);
    s.misses += 1;
    return undefined;
  }
  // Refresh recency: Map preserves insertion order, so re-inserting moves it
  // to the back and makes eviction least-recently-used.
  s.map.delete(key);
  s.map.set(key, entry);
  s.hits += 1;
  return { ...entry.value };
}

/** Stores a successful verification. Never call this with a failed result. */
export function setCached(key: string, value: Record<string, unknown>): void {
  if (!cacheEnabled()) return;
  const ttl = ttlMs();
  if (ttl <= 0) return;
  const s = store();
  s.map.delete(key);
  s.map.set(key, { value, expiresAt: Date.now() + ttl });
  prune(s);
}

/** Insertion-order prune: expired entries first, then oldest beyond the cap. */
function prune(s: CacheStore): void {
  const now = Date.now();
  for (const [k, v] of s.map) {
    if (v.expiresAt <= now) s.map.delete(k);
  }
  const cap = maxEntries();
  while (s.map.size > cap) {
    const oldest = s.map.keys().next();
    if (oldest.done) break;
    s.map.delete(oldest.value);
    s.evictions += 1;
  }
}

export function clearCache(): void {
  const s = store();
  s.map.clear();
  s.hits = 0;
  s.misses = 0;
  s.evictions = 0;
}

export function cacheStats(): {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
} {
  const s = store();
  const total = s.hits + s.misses;
  return {
    size: s.map.size,
    hits: s.hits,
    misses: s.misses,
    evictions: s.evictions,
    hitRate: total === 0 ? 0 : s.hits / total,
  };
}
