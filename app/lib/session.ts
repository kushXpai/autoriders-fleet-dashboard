// app/lib/session.ts
// SERVER-ONLY: signed-cookie sessions for API route authorization.

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "./auth";

export const SESSION_COOKIE = "fleet_session";
export const SESSION_MAX_AGE_S = 2 * 60 * 60; // keep in sync with auth.ts (2 hours)

interface Payload {
  u: string;
  r: User["role"];
  b?: string[];
  exp: number; // epoch seconds
}

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.AWS_SECRET_ACCESS_KEY;
  if (!s) throw new Error("SESSION_SECRET (or AWS_SECRET_ACCESS_KEY) must be set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(user: User): string {
  const payload: Payload = {
    u: user.username,
    r: user.role,
    b: user.branches,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifyToken(token: string | undefined): User | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return { username: p.u, role: p.r, branches: p.b };
  } catch {
    return null;
  }
}

export function getSession(request: NextRequest): User | null {
  return verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(res: NextResponse, user: User): void {
  res.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Returns the session user if signed in with one of the allowed roles,
 * otherwise a ready-made 401/403 response to return from the route.
 */
export function requireRole(
  request: NextRequest,
  roles?: User["role"][]
): { user: User; denied?: undefined } | { user?: undefined; denied: NextResponse } {
  const user = getSession(request);
  if (!user) {
    return { denied: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { denied: NextResponse.json({ error: "You do not have permission to do this" }, { status: 403 }) };
  }
  return { user };
}

export const UPLOAD_ROLES: User["role"][] = ["developer", "superadmin"];
