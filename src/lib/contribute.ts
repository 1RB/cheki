/**
 * Private receipt contributions for banks that are still in development.
 *
 * A contributor pastes a receipt share link, uploads a screenshot, or enters a
 * reference plus phone or account on the bank's page. POST /api/contribute
 * validates it here and forwards it to a private Telegram chat via the Bot
 * API. Nothing is stored or logged: the message is the only copy, and it is
 * deleted once the parser is built.
 */
import { getBank } from "./manifest/loader";

export interface Contribution {
  bank: string;
  bankName: string;
  link?: string;
  reference?: string;
  phoneOrAccount?: string;
  credit?: string;
  /** A screenshot travels with the submission (sent as a Telegram photo). */
  image?: ImageMeta;
}

export interface ImageMeta {
  type: string;
  size: number;
}

export type ContributionResult =
  | { ok: true; value: Contribution }
  | { ok: false; error: string };

/** JSON bodies (text-only submissions). */
export const MAX_BODY_BYTES = 4096;
/** The client re-encodes screenshots to JPEG and keeps them under this. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** Multipart bodies, under Vercel's 4.5 MB request limit. */
export const MAX_MULTIPART_BYTES = 4_400_000;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Shown to visitors when the server is missing its Telegram settings. */
export const PAUSED_MESSAGE = "Submissions are paused right now. Try again later.";

export type LeadMode = "screenshot" | "link";

/**
 * Whether the contribute box leads with the share link or with a screenshot.
 * Banks with a known receipt URL template lead with the link; banks whose
 * endpoint is still unknown lead with a screenshot, since a link may not exist.
 */
export function contributeLeadMode(bankId: string): LeadMode {
  const endpoint = getBank(bankId)?.endpoint?.trim() ?? "";
  return endpoint && endpoint.toLowerCase() !== "unknown" ? "link" : "screenshot";
}

/** Checks the declared type and size of an uploaded screenshot. */
export function validateImageMeta(image: ImageMeta): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(image.type)) {
    return "Upload the screenshot as a JPEG, PNG or WebP image.";
  }
  if (!(image.size > 0)) return "That screenshot looks empty. Try another one.";
  if (image.size > MAX_IMAGE_BYTES) return "That screenshot is too large. Crop it and try again.";
  return null;
}

/** Reads the real image type from the first bytes, so a renamed file cannot slip through. */
export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) return "image/webp";
  return null;
}
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

export function validateContribution(input: unknown, image?: ImageMeta): ContributionResult {
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

  if (image) {
    const imageError = validateImageMeta(image);
    if (imageError) return { ok: false, error: imageError };
  }

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
  } else if (reference || !image) {
    if (!reference) return { ok: false, error: "Add a screenshot, paste the receipt link, or enter the reference." };
    if (reference.length > MAX_REF || !/^[A-Za-z0-9/_.-]+$/.test(reference)) {
      return { ok: false, error: "The reference should be letters and digits only." };
    }
    // A screenshot shows the rest of the receipt, so the second field is only
    // required for a bare reference.
    const needsSecond = (bank.requiresAccount || bank.requiresPhone) && !image;
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
      ...(link ? { link } : reference ? { reference } : {}),
      ...(phoneOrAccount ? { phoneOrAccount } : {}),
      ...(credit ? { credit } : {}),
      ...(image ? { image: { type: image.type, size: image.size } } : {}),
    },
  };
}

/** Plain text (no parse_mode), so nothing in the submission needs escaping. */
export function formatTelegramMessage(c: Contribution, receivedAt: string): string {
  const lines = [
    `New receipt for ${c.bankName} (${c.bank})`,
    c.link ? `Link: ${c.link}` : c.reference ? `Reference: ${c.reference}` : null,
    c.image ? `Screenshot: attached (${c.image.type}, ${Math.max(1, Math.round(c.image.size / 1024))} KB)` : null,
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

/** Telegram caps photo captions at 1024 characters. */
export const MAX_CAPTION = 1024;

/**
 * Sends the screenshot with the submission text as its caption. Tries
 * sendPhoto, then sendDocument, which accepts sizes and aspect ratios
 * sendPhoto refuses (very tall screenshots). The bytes are only held in memory.
 */
export async function sendTelegramPhoto(
  token: string,
  chatId: string,
  caption: string,
  bytes: Uint8Array,
  type: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const text = caption.length > MAX_CAPTION ? caption.slice(0, MAX_CAPTION - 3) + "..." : caption;
  for (const [method, field] of [["sendPhoto", "photo"], ["sendDocument", "document"]] as const) {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", text);
    form.append(field, new Blob([bytes as BlobPart], { type }), `receipt.${ext}`);
    const resp = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    if (resp.ok) {
      const data = (await resp.json().catch(() => null)) as { ok?: boolean } | null;
      if (data?.ok === true) return true;
    }
  }
  return false;
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
