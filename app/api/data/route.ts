// app/api/data/route.ts

import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE_NAME } from "../../lib/dynamodb";
import type { FleetRow } from "../../lib/types";

// Paginated scan — DynamoDB Limit is NOT a filter, it caps items read per page.
// We must keep paginating via LastEvaluatedKey until all items are fetched.
async function scanAll(): Promise<FleetRow[]> {
  const items: FleetRow[] = [];
  let lastKey: Record<string, unknown> | undefined = undefined;
  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );
    if (result.Items) items.push(...(result.Items as FleetRow[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

// Paginated query for a single branch
async function queryBranch(branch: string): Promise<FleetRow[]> {
  const items: FleetRow[] = [];
  let lastKey: Record<string, unknown> | undefined = undefined;
  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `BRANCH#${branch}` },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );
    if (result.Items) items.push(...(result.Items as FleetRow[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get("branch");
    const role = searchParams.get("role");

    let items: FleetRow[] =
      branch && role !== "superadmin" && role !== "admin"
        ? await queryBranch(branch)
        : await scanAll();

    // Normalize fields so UI filtering is consistent regardless of stored casing
    // Branch → lowercase ("Bangalore" / "BANGALORE" → "bangalore")
    // Month → title case ("APRIL" / "april" → "April") to match MONTH_ORDER array
    items = items.map((item) => {
      const rawMonth = item.Month || "";
      const titleMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
      return {
        ...item,
        Branch: (item.Branch || "").toLowerCase(),
        Month: titleMonth,
      };
    });

    // DataManager expects a `files` array — derive it from unique _fileName values
    const fileMap = new Map<string, { name: string; sha: string; download_url: string }>();
    items.forEach((item) => {
      const fn = (item as unknown as Record<string, string>)["_fileName"];
      if (fn && !fileMap.has(fn)) {
        fileMap.set(fn, { name: fn, sha: fn, download_url: "" });
      }
    });

    return NextResponse.json({ data: items, files: [...fileMap.values()] });
  } catch (err) {
    console.error("Data fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch data: " + (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    // Paginated scan to find all items with this _fileName
    const toDelete: { pk: unknown; sk: unknown }[] = [];
    let lastKey: Record<string, unknown> | undefined = undefined;
    do {
      const scan = await dynamo.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: "#fn = :fn",
          ExpressionAttributeNames: { "#fn": "_fileName" },
          ExpressionAttributeValues: { ":fn": filename },
          ProjectionExpression: "pk, sk",
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        })
      );
      if (scan.Items) toDelete.push(...scan.Items as { pk: unknown; sk: unknown }[]);
      lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    if (toDelete.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Batch delete in groups of 25
    const { BatchWriteCommand } = await import("@aws-sdk/lib-dynamodb");
    const batches = chunk(toDelete, 25);
    for (const batch of batches) {
      await dynamo.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch.map((item) => ({
              DeleteRequest: { Key: { pk: item.pk, sk: item.sk } },
            })),
          },
        })
      );
    }

    return NextResponse.json({ success: true, deleted: toDelete.length });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json(
      { error: "Delete failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}