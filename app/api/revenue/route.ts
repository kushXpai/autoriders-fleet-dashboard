// app/api/revenue/route.ts
// Handles GET (fetch revenue trips, paged) and POST (upload revenue Excel/CSV)

import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../../lib/dynamodb";
import { batchWriteWithRetry, chunk } from "../../lib/dynamoBatch";
import { requireRole } from "../../lib/session";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const REVENUE_TABLE = process.env.REVENUE_TABLE_NAME || "autoriders-revenue";
const BATCH_SIZE = 25;
const WRITE_CONCURRENCY = 8;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — billing exports can be large

// One page per request keeps each response small; the client follows `nextCursor`.
// Parallel scan: the client asks for several `segment`s (of `totalSegments`) at once,
// each with its own cursor, so a big table loads in a fraction of the time.
function decodeCursor(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    return undefined;
  }
}

// Short-lived page cache (cleared on every upload) so tab switches/reloads are instant.
const PAGE_TTL_MS = 5 * 60 * 1000;
const pageCache = new Map<string, { at: number; body: { data: unknown[]; nextCursor: string | null } }>();

export async function GET(request: NextRequest) {
  try {
    const { denied } = requireRole(request, ["developer"]);
    if (denied) return denied;

    const params = new URL(request.url).searchParams;
    const totalSegments = Math.min(Math.max(parseInt(params.get("totalSegments") ?? "1", 10) || 1, 1), 16);
    const segment = Math.min(Math.max(parseInt(params.get("segment") ?? "0", 10) || 0, 0), totalSegments - 1);
    const cursorRaw = params.get("cursor");

    const cacheKey = `${segment}/${totalSegments}/${cursorRaw ?? ""}`;
    const hit = pageCache.get(cacheKey);
    if (hit && Date.now() - hit.at < PAGE_TTL_MS) return NextResponse.json(hit.body);

    const startKey = decodeCursor(cursorRaw);
    const res = await dynamo.send(
      new ScanCommand({
        TableName: REVENUE_TABLE,
        ...(totalSegments > 1 ? { Segment: segment, TotalSegments: totalSegments } : {}),
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      })
    );
    const nextCursor = res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64url")
      : null;
    const body = { data: res.Items ?? [], nextCursor };
    if (pageCache.size > 300) pageCache.clear();
    pageCache.set(cacheKey, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    console.error("Revenue GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch revenue data: " + (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { denied } = requireRole(request, ["developer"]);
    if (denied) return denied;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "File has no data rows" }, { status: 400 });
    }

    const uploadedAt = new Date().toISOString();
    const clean = (v: string | undefined, fallback: string) =>
      (v || fallback).trim().replace(/[^a-zA-Z0-9\-\/]/g, "_") || fallback;
    // Keys come from the data (booking + invoice), not the row position, so
    // re-uploading the same file — even re-sorted — overwrites instead of duplicating.
    const seen = new Set<string>();
    const items = rows
      .filter((r) => r["BOOKING REFERENCE NUMBER"] || r["INVOICE NUMBER"])
      .map((row, idx) => {
        const bookingRef = clean(row["BOOKING REFERENCE NUMBER"], `ROW${idx}`);
        const invoiceNo = clean(row["INVOICE NUMBER"], "NA");
        const invoiceMonth = clean(row["INVOICE MONTH"], "unknown");
        const base = `${bookingRef}#${invoiceNo}`;
        let sk = base;
        for (let n = 2; seen.has(`${invoiceMonth}|${sk}`); n++) sk = `${base}#${n}`;
        seen.add(`${invoiceMonth}|${sk}`);
        return {
          ...row,
          pk: `REVENUE#${invoiceMonth}`,
          sk,
          _uploadedAt: uploadedAt,
          _fileName: file.name,
        };
      });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No rows with a BOOKING REFERENCE NUMBER or INVOICE NUMBER found" },
        { status: 422 }
      );
    }

    // Write several batches concurrently so large files finish within maxDuration.
    let inserted = 0;
    let failed = 0;
    const batches = chunk(items, BATCH_SIZE);
    for (const group of chunk(batches, WRITE_CONCURRENCY)) {
      const lefts = await Promise.all(
        group.map((batch) =>
          batchWriteWithRetry(
            REVENUE_TABLE,
            batch.map((item) => ({ PutRequest: { Item: item } }))
          )
        )
      );
      group.forEach((batch, i) => {
        inserted += batch.length - lefts[i];
        failed += lefts[i];
      });
    }

    if (failed > 0) {
      return NextResponse.json(
        { error: `${failed} rows were not written (DynamoDB throttled). Re-upload the file.`, inserted },
        { status: 502 }
      );
    }

    pageCache.clear();
    return NextResponse.json({ success: true, inserted });
  } catch (err) {
    console.error("Revenue POST error:", err);
    return NextResponse.json(
      { error: "Upload failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}