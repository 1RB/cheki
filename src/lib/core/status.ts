/**
 * Transaction status classification, shared by the verification gate (server)
 * and the result card (client). Keep this file free of Node imports.
 */
export type StatusTone = "success" | "failure" | "unknown";

const FAILURE_RE =
  /\b(fail(?:ed|ure|s)?|unsuccessful|revers(?:ed|al|e)|pending|cancel(?:l)?ed|cancel(?:l)?ation|declined|rejected|expired|refunded|error|timed?\s?out|in\s+progress|processing|on\s+hold|initiated|incomplete|not\s+(?:completed|successful|paid)|voided?|charge\s?backs?|disputed?|suspended|rolled\s?back|returned|bounced)\b/i;

const SUCCESS_RE =
  /^(?:completed?|success(?:ful)?|succeeded|paid|done|approved|settled|confirmed|posted|ok|transaction\s+(?:completed|successful))\.?$/i;

/**
 * "failure" for any status that names a non-final or failed state (Failed,
 * Reversed, Pending, Cancelled, ...). "success" only for a clear completed
 * word. Everything else, including an empty status, is "unknown".
 */
export function classifyStatus(status: string | undefined | null): StatusTone {
  if (!status) return "unknown";
  const s = String(status).trim().slice(0, 80);
  if (!s) return "unknown";
  if (FAILURE_RE.test(s)) return "failure";
  if (SUCCESS_RE.test(s)) return "success";
  return "unknown";
}
