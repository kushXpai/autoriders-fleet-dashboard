// app/lib/api.ts
// Client-side helpers for talking to the API routes.

import { clearUser } from "./auth";
import type { FleetRow, RevenueRow } from "./types";

/** Parse a response as JSON; falls back to a readable error for HTML/empty bodies. */
export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== "undefined") {
    // Server session missing/expired — send the user back to sign in
    clearUser();
    window.location.href = "/login";
    throw new Error("Your session has expired. Please sign in again.");
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const hint =
      res.status === 413
        ? "File is too large for the server."
        : res.status === 504 || res.status === 502
        ? "The server timed out. Try fewer or smaller files."
        : `Server returned an unexpected response (HTTP ${res.status}).`;
    throw new Error(hint);
  }
}

export interface UploadResult {
  success?: boolean;
  inserted?: number;
  duplicates?: string[];
  errors?: string[];
  error?: string;
}

/** POST files to /api/upload and return the parsed result (throws on HTTP/network failure). */
export async function postFleetFiles(files: File[], overwrite: boolean): Promise<UploadResult> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  if (overwrite) formData.append("overwrite", "true");
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const body = await readJson<UploadResult>(res);
  if (!res.ok) throw new Error(body.error || `Upload failed (HTTP ${res.status})`);
  return body;
}

/** Loads every fleet row the signed-in user may see, following the server's page cursor. */
export async function fetchAllFleetData(): Promise<FleetRow[]> {
  const rows: FleetRow[] = [];
  let cursor: string | null = null;
  do {
    const url: string = cursor ? `/api/data?cursor=${encodeURIComponent(cursor)}` : "/api/data";
    const res = await fetch(url, { cache: "no-store" });
    const body = await readJson<{ data?: FleetRow[]; nextCursor?: string | null; error?: string }>(res);
    if (!res.ok || !body.data) throw new Error(body.error || `Failed to load data (HTTP ${res.status})`);
    rows.push(...body.data);
    cursor = body.nextCursor ?? null;
  } while (cursor);
  return rows;
}

const REVENUE_SEGMENTS = 8;

/** Loads every revenue row (developer only): parallel scan segments, each following its own cursor. */
export async function fetchAllRevenue(): Promise<RevenueRow[]> {
  const loadSegment = async (segment: number): Promise<RevenueRow[]> => {
    const rows: RevenueRow[] = [];
    let cursor: string | null = null;
    do {
      const qs = new URLSearchParams({ segment: String(segment), totalSegments: String(REVENUE_SEGMENTS) });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`/api/revenue?${qs}`);
      const body = await readJson<{ data?: RevenueRow[]; nextCursor?: string | null; error?: string }>(res);
      if (!res.ok || !body.data) throw new Error(body.error || `Failed to load revenue data (HTTP ${res.status})`);
      rows.push(...body.data);
      cursor = body.nextCursor ?? null;
    } while (cursor);
    return rows;
  };
  const parts = await Promise.all(Array.from({ length: REVENUE_SEGMENTS }, (_, i) => loadSegment(i)));
  return parts.flat();
}
