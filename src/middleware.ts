import { NextRequest, NextResponse } from "next/server";

// Middleware: presence-check for the session cookie on /app routes.
// Full signature verification + workspace authorization happens server-side in
// every route handler (plan §17: middleware alone is not trusted).
export function middleware(req: NextRequest) {
  const token = req.cookies.get("gf_session")?.value;
  if (!token) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
