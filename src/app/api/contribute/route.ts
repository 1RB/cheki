import { NextRequest, NextResponse } from "next/server";
import {
  MAX_BODY_BYTES,
  MAX_MULTIPART_BYTES,
  PAUSED_MESSAGE,
  RateLimiter,
  clientIp,
  formatTelegramMessage,
  sendTelegramMessage,
  sendTelegramPhoto,
  sniffImageType,
  validateContribution,
} from "@/lib/contribute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = new RateLimiter(5, 10 * 60 * 1000);

const SEND_FAILED = "We could not pass your receipt on right now. Nothing was saved. Try again later.";

function fail(error: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, error }, { status, headers });
}

interface Parsed {
  body: Record<string, unknown>;
  image?: { bytes: Uint8Array; type: string; size: number };
}

/**
 * Reads either a JSON body (text only) or a multipart form with an optional
 * "image" file. Returns a Response when the body is unusable.
 */
async function readBody(request: NextRequest): Promise<Parsed | NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  const declared = Number(request.headers.get("content-length") ?? "0");

  if (contentType.startsWith("multipart/form-data")) {
    if (declared > MAX_MULTIPART_BYTES) return fail("That screenshot is too large. Crop it and try again.", 413);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail("Send the form again.", 400);
    }
    const body: Record<string, unknown> = {};
    for (const key of ["bank", "link", "reference", "phoneOrAccount", "credit", "website"]) {
      const v = form.get(key);
      if (typeof v === "string") body[key] = v;
    }
    body.consent = form.get("consent") === "true";

    const file = form.get("image");
    if (file && typeof file !== "string") {
      if (file.size > MAX_MULTIPART_BYTES) return fail("That screenshot is too large. Crop it and try again.", 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Trust the bytes, not the declared type: anything that is not a real
      // JPEG, PNG or WebP fails validation as an unsupported type.
      const type = sniffImageType(bytes) ?? "application/octet-stream";
      return { body, image: { bytes, type, size: bytes.length } };
    }
    return { body };
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail("Submission too large.", 413);
    return { body: JSON.parse(raw) };
  } catch {
    return fail("Send a JSON body.", 400);
  }
}

/**
 * POST /api/contribute
 *
 * Forwards a contributed receipt link, reference or screenshot privately to
 * the maintainers' Telegram chat. The submission is never stored or logged;
 * Telegram holds the only copy, which is deleted once the parser is built.
 */
export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CONTRIB_CHAT_ID;
  if (!token || !chatId) {
    // Configuration detail stays in the server log; visitors get a generic notice.
    const missing = [!token && "TELEGRAM_BOT_TOKEN", !chatId && "TELEGRAM_CONTRIB_CHAT_ID"].filter(Boolean).join(", ");
    console.error(`[contribute] submissions disabled: missing ${missing}`);
    return fail(PAUSED_MESSAGE, 503);
  }

  const retryAfter = limiter.check(clientIp(request.headers));
  if (retryAfter > 0) {
    return fail("Too many submissions from your network. Try again in a few minutes.", 429, {
      "Retry-After": String(retryAfter),
    });
  }

  const parsed = await readBody(request);
  if (parsed instanceof NextResponse) return parsed;

  const { body, image } = parsed;
  const result = validateContribution(body, image ? { type: image.type, size: image.size } : undefined);
  if (!result.ok) return fail(result.error, 400);

  try {
    const text = formatTelegramMessage(result.value, new Date().toISOString());
    const sent = image
      ? await sendTelegramPhoto(token, chatId, text, image.bytes, image.type)
      : await sendTelegramMessage(token, chatId, text);
    if (!sent) return fail(SEND_FAILED, 502);
  } catch {
    return fail(SEND_FAILED, 502);
  }

  return NextResponse.json(
    { success: true, message: "Thanks. Your receipt was sent privately to the maintainers." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
