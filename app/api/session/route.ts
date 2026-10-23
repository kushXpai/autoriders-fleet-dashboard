// app/api/session/route.ts
// Lets the client confirm its server session cookie is still valid.
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "../../lib/session";

export async function GET(request: NextRequest) {
  const { user, denied } = requireRole(request);
  if (denied) return denied;
  return NextResponse.json({ user });
}
