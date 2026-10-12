/**
 * Per-IP limits of the hosted API, one entry per route family.
 *
 * Plain data with no server imports, so copy that quotes the limits (the
 * guides, /compare, the SEO pages) can read them in client components too.
 * `limiters` in ./rate-limit is built from this table, so the copy and the
 * enforcement can't drift apart.
 */
const MINUTE = 60 * 1000;

export const RATE_LIMITS = {
  /** Single verifications; batch items also count against this bucket. */
  verify: { limit: 30, windowMs: MINUTE },
  /** Batch requests themselves. */
  batch: { limit: 5, windowMs: MINUTE },
  parse: { limit: 20, windowMs: MINUTE },
  ocr: { limit: 20, windowMs: MINUTE },
  /** /api/contribute: a low-volume form that forwards to Telegram. */
  contribute: { limit: 5, windowMs: 10 * MINUTE },
} as const;
