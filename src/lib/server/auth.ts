// Authentication (MVP): cookie session (HMAC-signed), SHA-256 password hash.
// Demo-grade: adequate for a judged demo, not production crypto.
// Sessions are httpOnly; every protected route re-verifies the user server
// side (plan §17 — middleware alone is not trusted).
import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { UserProfile } from "@/lib/types";
import { getStore } from "@/lib/server/store";

const SECRET = process.env.SESSION_SECRET || "gapfinder-dev-secret";
export const SESSION_COOKIE = "gf_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export function hashPassword(pw: string): string {
  return crypto.createHash("sha256").update(`${SECRET}:${pw}`).digest("hex");
}

export function verifyPassword(user: UserProfile, pw: string): boolean {
  return user.passwordHash === hashPassword(pw);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const body = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const ok =
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload?.userId !== "string" || payload.exp < Date.now()) return null;
    return payload.userId as string;
  } catch {
    return null;
  }
}

/** Current user or null; call inside server components / route handlers. */
export async function currentUser(): Promise<UserProfile | null> {
  const jar = cookies();
  const userId = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const store = await getStore();
  return store.users[userId] ?? null;
}

export function applySessionCookie(res: NextResponse, userId: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production" && process.env.VERCEL === "1",
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
