/**
 * One URL per page: every route on cheki.et is lowercase, so a path with a
 * capital letter (https://cheki.et/Guides, which Google indexed from a typed
 * link and served as a 404) answers one 301 to its lowercase form, query
 * kept. Lowercase paths pass straight through. Files with an extension, the
 * API and Next's own assets are not matched (see `config.matcher`).
 */
import { NextResponse, type NextRequest } from "next/server";

export function lowercasePath(pathname: string): string | null {
  const lower = pathname.toLowerCase();
  return lower === pathname ? null : lower;
}

export function proxy(request: NextRequest) {
  const lower = lowercasePath(request.nextUrl.pathname);
  if (!lower) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = lower;
  return NextResponse.redirect(url, 301);
}

export const config = {
  // Only paths that contain a capital letter, outside /api, /_next and files.
  matcher: ["/((?!api/|_next/)(?![^?]*\\.[A-Za-z0-9]+$)[^?]*[A-Z][^?]*)"],
};
