import { NextRequest, NextResponse } from "next/server";
import { getStore, mutate } from "@/lib/server/store";
import {
  applySessionCookie,
  clearSessionCookie,
  hashPassword,
  verifyPassword,
} from "@/lib/server/auth";
import { emptyWorkspaceFor } from "@/lib/server/seed";
import type { UserProfile } from "@/lib/types";

// Tiny in-memory IP limiter for the auth route (§17: request rate limits).
const hits = new Map<string, { n: number; resetAt: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.resetAt < now) {
    hits.set(ip, { n: 1, resetAt: now + 5 * 60 * 1000 });
    return false;
  }
  cur.n += 1;
  return cur.n > 30;
}

function publicUser(u: UserProfile) {
  return { id: u.id, email: u.email, name: u.name, kind: u.kind };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (limited(ip)) {
    return NextResponse.json({ error: "Too many attempts, slow down (rate limit)." }, { status: 429 });
  }

  let body: { action?: string; email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (body.action === "logout") {
    return clearSessionCookie(NextResponse.json({ ok: true }));
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (body.action === "login") {
    const store = await getStore();
    const user = Object.values(store.users).find((u) => u.email === email);
    if (!user || !verifyPassword(user, password)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    return applySessionCookie(NextResponse.json({ user: publicUser(user) }), user.id);
  }

  if (body.action === "register") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    return mutate((store) => {
      if (Object.values(store.users).some((u) => u.email === email)) {
        return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
      }
      const id = "u_" + crypto.randomUUID();
      const user: UserProfile = {
        id,
        email,
        name: body.name?.trim() || email.split("@")[0],
        kind: "regular",
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      store.users[id] = user;
      store.workspaces[id] = emptyWorkspaceFor(id, user.name);
      return applySessionCookie(NextResponse.json({ user: publicUser(user) }), id);
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
