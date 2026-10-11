/**
 * Read a JSON request body with a hard byte cap.
 *
 * Route handlers have no body limit of their own when self-hosted (the
 * serverActions.bodySizeLimit setting does not apply to them), and
 * request.json() / request.formData() buffer everything first. These check
 * Content-Length, then stream and stop past the cap.
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

/**
 * Read the raw request body with a hard byte cap. Content-Length is checked
 * first, but the stream is capped too, so a chunked upload with no
 * Content-Length (or a lying one) still stops at `maxBytes`.
 */
export async function readBytesCapped(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError(maxBytes);
  if (!request.body) return Buffer.alloc(0);
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
  return Buffer.concat(chunks);
}

export async function readTextCapped(request: Request, maxBytes: number): Promise<string> {
  return (await readBytesCapped(request, maxBytes)).toString("utf8");
}

/**
 * Read a multipart/form-data (or urlencoded) body with a hard byte cap, then
 * parse it from the capped bytes. request.formData() alone buffers the whole
 * upload, however large, before anything can check its size.
 */
export async function readFormDataCapped(request: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readBytesCapped(request, maxBytes);
  const contentType = request.headers.get("content-type") ?? "";
  try {
    return await new Response(new Uint8Array(bytes), { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new InvalidFormDataError();
  }
}

export class InvalidFormDataError extends Error {
  constructor() {
    super("Request body must be multipart form data.");
    this.name = "InvalidFormDataError";
  }
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
  if (e instanceof InvalidFormDataError) return { status: 400, error: e.message };
  return null;
}
