// app/api/revenue/route.ts
// Handles GET (fetch all revenue trips) and POST (upload revenue Excel/CSV)

import { NextRequest, NextResponse } from "next/server";
import { BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../../lib/dynamodb";
import * as XLSX from "xlsx";

const REVENUE_TABLE = process.env.REVENUE_TABLE_NAME || "autoriders-revenue";
const BATCH_SIZE = 25;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — billing exports can be large

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

export async function GET() {
  try {
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
      .filter((r) => r["Booking Ref No"] || r["Invoice No"])
      .map((row, idx) => {
        // Build stable PK/SK from booking ref + row index (fallback)
        const bookingRef = (row["Booking Ref No"] || `ROW${idx}`).replace(/[^a-zA-Z0-9\-\/]/g, "_");
        const invoiceMonth = (row["Invoice Month"] || "unknown").replace(/[^a-zA-Z0-9\-\/]/g, "_");
        return {
          pk: `REVENUE#${invoiceMonth}`,
          sk: `${bookingRef}#${idx}`,
          _uploadedAt: uploadedAt,
          _fileName: file.name,
          ...row,
        };
      });

    const batches = chunk(items, BATCH_SIZE);
    let inserted = 0;
    for (const batch of batches) {
      await dynamo.send(
        new BatchWriteCommand({
          RequestItems: {
            [REVENUE_TABLE]: batch.map((item) => ({ PutRequest: { Item: item } })),
          },
        })
      );
      inserted += batch.length;
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