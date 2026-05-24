// app/api/data/route.ts

import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE_NAME } from "../../lib/dynamodb";
import type { FleetRow } from "../../lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get("branch");
    const role = searchParams.get("role");

    let items: FleetRow[] = [];

    if (branch && role !== "superadmin" && role !== "admin") {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": `BRANCH#${branch}` },
          Limit: 5000,
        })
      );
      items = (result.Items as FleetRow[]) || [];
    } else {
      const result = await dynamo.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          Limit: 5000,
        })
      );
      items = (result.Items as FleetRow[]) || [];
    }

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

    // Scan for all items with this _fileName and delete them
    const scan = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#fn = :fn",
        ExpressionAttributeNames: { "#fn": "_fileName" },
        ExpressionAttributeValues: { ":fn": filename },
        ProjectionExpression: "pk, sk",
      })
    );

    const toDelete = scan.Items || [];
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