// app/api/data/route.ts

import { NextRequest, NextResponse } from "next/server";
import { BatchWriteCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
    const branch = searchParams.get("branch") || "";
    const role = searchParams.get("role") || "";
    const branchesParam = searchParams.get("branches") || "";

    let items: FleetRow[];
    if (role === "superadmin" || role === "admin" || role === "developer") {
      items = await scanAll();
    } else if (role === "manager" && branchesParam) {
      const branchList = branchesParam.split(",").filter(Boolean);
      const results = await Promise.all(branchList.map((b) => queryBranch(b)));
      items = results.flat();
    } else if (branch) {
      items = await queryBranch(branch);
    } else {
      items = await scanAll();
    }

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
    const body = await request.json();
    const { filename, branch, month, year } = body as {
      filename?: string;
      branch?: string;
      month?: string;
      year?: string;
    };

    // ── Delete by branch + month + year ──────────────────────────────────
    if (branch && month && year) {
      const keys = await fetchKeysForBranchMonth(
        branch.toLowerCase(),
        month,
        year
      );
      if (keys.length === 0) return NextResponse.json({ success: true, deleted: 0 });
      for (const batch of chunk(keys, 25)) {
        await dynamo.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: batch.map((key) => ({
                DeleteRequest: { Key: { pk: key.pk, sk: key.sk } },
              })),
            },
          })
        );
      }
      return NextResponse.json({ success: true, deleted: keys.length });
    }

    // ── Delete by filename ────────────────────────────────────────────────
    if (filename) {
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

      if (toDelete.length === 0) return NextResponse.json({ success: true, deleted: 0 });
      for (const batch of chunk(toDelete, 25)) {
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
    }

    return NextResponse.json({ error: "branch + month + year, or filename required" }, { status: 400 });
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

async function fetchKeysForBranchMonth(
  branch: string,
  month: string,
  year: string
): Promise<{ pk: string; sk: string }[]> {
  const keys: { pk: string; sk: string }[] = [];
  let lastKey: Record<string, unknown> | undefined = undefined;
  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `BRANCH#${branch}`,
          ":prefix": `${year}#${month}#`,
        },
        ProjectionExpression: "pk, sk",
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      })
    );
    if (result.Items) keys.push(...(result.Items as { pk: string; sk: string }[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return keys;
}