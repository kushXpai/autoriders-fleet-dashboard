// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "../../lib/credentials";
import { setSessionCookie } from "../../lib/session";

// Basic brute-force throttle (per server instance): 10 failures → 15 min lockout.
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; until: number }>();

export async function POST(request: NextRequest) {
  try {
    const { username, password } = (await request.json()) as {
      username?: string;
      password?: string;
    };
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const key = `${ip}|${username.toLowerCase().trim()}`;
    const rec = fails.get(key);
    if (rec && rec.until > Date.now() && rec.count >= MAX_FAILS) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const user = authenticate(username, password);
    if (!user) {
      const count = (rec && rec.until > Date.now() ? rec.count : 0) + 1;
      fails.set(key, { count, until: Date.now() + LOCK_MS });
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    fails.delete(key);
    const res = NextResponse.json({ user });
    setSessionCookie(res, user);
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
