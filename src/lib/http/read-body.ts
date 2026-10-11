/**
 * Read a JSON request body with a hard byte cap.
 *
 * Route handlers have no body limit of their own when self-hosted (the
 * serverActions.bodySizeLimit setting does not apply to them), and
 * request.json() buffers everything first. This checks Content-Length, then
 * streams and stops past the cap.
 */
export class BodyTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super("Request body is too large.");
    this.name = "BodyTooLargeError";
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super("Request body must be valid JSON.");
    this.name = "InvalidJsonError";
  }
}

export async function readTextCapped(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError(maxBytes);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonCapped<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const text = await readTextCapped(request, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

/** Status and message for a body-reading error, or null if it is something else. */
export function bodyErrorResponse(e: unknown): { status: number; error: string } | null {
  if (e instanceof BodyTooLargeError) {
    return { status: 413, error: `Request body is too large (limit ${Math.round(e.limit / 1024)} KB).` };
  }
  if (e instanceof InvalidJsonError) return { status: 400, error: e.message };
  return null;
}
