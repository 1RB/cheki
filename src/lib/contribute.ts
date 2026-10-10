/**
 * Private receipt contributions for banks that are still in development.
 *
 * A contributor pastes a receipt share link (or a reference plus phone or
 * account) on the bank's page. POST /api/contribute validates it here and
 * forwards it to a private Telegram chat via the Bot API. Nothing is stored
 * or logged: the message is the only copy, and it is deleted once the parser
 * is built.
 */
import { getBank } from "./manifest/loader";

export interface Contribution {
  bank: string;
  bankName: string;
  link?: string;
  reference?: string;
  phoneOrAccount?: string;
  credit?: string;
}

export type ContributionResult =
  | { ok: true; value: Contribution }
  | { ok: false; error: string };

export const MAX_BODY_BYTES = 4096;
const MAX_LINK = 600;
const MAX_REF = 64;
const MAX_CREDIT = 60;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Strip control characters so a value cannot break the message layout. */
function tidy(v: string): string {
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function validateContribution(input: unknown): ContributionResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Send a JSON body." };
  const body = input as Record<string, unknown>;

  // Honeypot: real visitors never see or fill this field.
  if (str(body.website)) return { ok: false, error: "Submission rejected." };

  if (body.consent !== true) {
    return { ok: false, error: "Tick the box to confirm the receipt is yours to share." };
  }

  const bankId = str(body.bank).toLowerCase();
  const bank = bankId ? getBank(bankId) : undefined;
  if (!bank) return { ok: false, error: "Unknown bank." };
  if (bank.status !== "in-development") {
    return { ok: false, error: `${bank.shortName ?? bank.name} is already live. Check the receipt on its page instead.` };
  }

  const link = tidy(str(body.link));
  const reference = tidy(str(body.reference));
  const phoneOrAccount = tidy(str(body.phoneOrAccount));
  const credit = tidy(str(body.credit));

  if (link) {
    if (link.length > MAX_LINK) return { ok: false, error: "That link is too long." };
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      return { ok: false, error: "Paste the full receipt link, starting with https://." };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, error: "Paste the full receipt link, starting with https://." };
    }
  } else {
    if (!reference) return { ok: false, error: "Paste the receipt link, or enter the reference." };
    if (reference.length > MAX_REF || !/^[A-Za-z0-9/_.-]+$/.test(reference)) {
      return { ok: false, error: "The reference should be letters and digits only." };
    }
    const needsSecond = bank.requiresAccount || bank.requiresPhone;
    if (needsSecond && !phoneOrAccount) {
      return {
        ok: false,
        error: bank.requiresPhone
          ? "Add the payer phone number, or paste the full receipt link."
          : "Add the receiving account number, or paste the full receipt link.",
      };
    }
  }

  if (phoneOrAccount && !/^\+?[0-9 ]{5,20}$/.test(phoneOrAccount)) {
    return { ok: false, error: "The phone or account number should be digits only." };
  }
  if (credit.length > MAX_CREDIT) return { ok: false, error: `Keep the name or handle under ${MAX_CREDIT} characters.` };

  return {
    ok: true,
    value: {
      bank: bank.id,
      bankName: bank.name,
      ...(link ? { link } : { reference }),
      ...(phoneOrAccount ? { phoneOrAccount } : {}),
      ...(credit ? { credit } : {}),
    },
  };
}

/** Plain text (no parse_mode), so nothing in the submission needs escaping. */
export function formatTelegramMessage(c: Contribution, receivedAt: string): string {
  const lines = [
    `New receipt for ${c.bankName} (${c.bank})`,
    c.link ? `Link: ${c.link}` : `Reference: ${c.reference}`,
    c.phoneOrAccount ? `Phone/account: ${c.phoneOrAccount}` : null,
    `Credit: ${c.credit || "anonymous"}`,
    `Received: ${receivedAt}`,
    "",
    "Consent given. Use only to build the parser, then delete this message.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const resp = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return false;
  const data = (await resp.json().catch(() => null)) as { ok?: boolean } | null;
  return data?.ok === true;
}

/**
 * Fixed-window rate limiter kept in memory. Per instance, so on serverless it
 * limits bursts rather than guaranteeing a global cap; that is enough for a
 * low-volume contribution form.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit = 5,
    private readonly windowMs = 10 * 60 * 1000,
    private readonly maxKeys = 5000,
  ) {}

  /** Returns 0 when allowed, otherwise the seconds until the next slot. */
  check(key: string, now: number = Date.now()): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000));
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) {
      for (const [k, times] of this.hits) {
        if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
      }
      if (this.hits.size > this.maxKeys) {
        const oldest = this.hits.keys().next().value;
        if (oldest !== undefined) this.hits.delete(oldest);
      }
    }
    return 0;
  }
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
