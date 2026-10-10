import { NextRequest, NextResponse } from "next/server";
import {
  MAX_BODY_BYTES,
  RateLimiter,
  clientIp,
  formatTelegramMessage,
  sendTelegramMessage,
  validateContribution,
} from "@/lib/contribute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = new RateLimiter(5, 10 * 60 * 1000);

/**
 * POST /api/contribute
 *
 * Forwards a contributed receipt link privately to the maintainers' Telegram
 * chat. The submission is never stored or logged; Telegram holds the only
 * copy, which is deleted once the parser is built.
 */
export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CONTRIB_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json(
      {
        success: false,
        error: "Receipt submissions are not set up on this server yet (TELEGRAM_BOT_TOKEN and TELEGRAM_CONTRIB_CHAT_ID are missing).",
      },
      { status: 503 },
    );
  }

  const retryAfter = limiter.check(clientIp(request.headers));
  if (retryAfter > 0) {
    return NextResponse.json(
      { success: false, error: "Too many submissions from your network. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Submission too large." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, error: "Send a JSON body." }, { status: 400 });
  }

  const result = validateContribution(body);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  try {
    const sent = await sendTelegramMessage(token, chatId, formatTelegramMessage(result.value, new Date().toISOString()));
    if (!sent) {
      return NextResponse.json(
        { success: false, error: "We could not pass your receipt on right now. Nothing was saved. Try again later." },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "We could not pass your receipt on right now. Nothing was saved. Try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { success: true, message: "Thanks. Your receipt was sent privately to the maintainers." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
