// app/api/revenue/route.ts
// Handles GET (fetch all revenue trips) and POST (upload revenue Excel/CSV)

import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../../lib/dynamodb";
import { batchWriteWithRetry, chunk } from "../../lib/dynamoBatch";
import { requireRole } from "../../lib/session";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const REVENUE_TABLE = process.env.REVENUE_TABLE_NAME || "autoriders-revenue";
const BATCH_SIZE = 25;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — billing exports can be large

// Scan all items from the revenue table with pagination
async function scanRevenue() {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await dynamo.send(
      new ScanCommand({
        TableName: REVENUE_TABLE,
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );
    if (res.Items) items.push(...res.Items);
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

export async function GET(request: NextRequest) {
  try {
    const { denied } = requireRole(request, ["developer"]);
    if (denied) return denied;

    const items = await scanRevenue();
    return NextResponse.json({ data: items });
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
    const items = rows
      .filter((r) => r["BOOKING REFERENCE NUMBER"] || r["INVOICE NUMBER"])
      .map((row, idx) => {
        // Build stable PK/SK from booking ref + row index (fallback)
        const bookingRef = (row["BOOKING REFERENCE NUMBER"] || `ROW${idx}`).replace(/[^a-zA-Z0-9\-\/]/g, "_");
        const invoiceMonth = (row["INVOICE MONTH"] || "unknown").replace(/[^a-zA-Z0-9\-\/]/g, "_");
        return {
          pk: `REVENUE#${invoiceMonth}`,
          sk: `${bookingRef}#${idx}`,
          _uploadedAt: uploadedAt,
          _fileName: file.name,
          ...row,
        };
      });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No rows with a BOOKING REFERENCE NUMBER or INVOICE NUMBER found" },
        { status: 422 }
      );
    }

    let inserted = 0;
    let failed = 0;
    for (const batch of chunk(items, BATCH_SIZE)) {
      const left = await batchWriteWithRetry(
        REVENUE_TABLE,
        batch.map((item) => ({ PutRequest: { Item: item } }))
      );
      inserted += batch.length - left;
      failed += left;
    }

    if (failed > 0) {
      return NextResponse.json(
        { error: `${failed} rows were not written (DynamoDB throttled). Re-upload the file.`, inserted },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, inserted });
  } catch (err) {
    console.error("Revenue POST error:", err);
    return NextResponse.json(
      { error: "Upload failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}