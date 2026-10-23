// app/api/data/route.ts

import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE_NAME } from "../../lib/dynamodb";
import { batchWriteWithRetry, chunk } from "../../lib/dynamoBatch";
import type { FleetRow } from "../../lib/types";
import { requireRole, UPLOAD_ROLES } from "../../lib/session";

// One DynamoDB read per request keeps every response small (the client follows
// `nextCursor` until it is null). The cursor is opaque: { i: source index, k: start key }.
const PAGE_LIMIT = 500;

type Source = { type: "scan" } | { type: "query"; branch: string };
interface Cursor {
  i: number;
  k?: Record<string, unknown>;
}

function decodeCursor(raw: string | null): Cursor {
  if (!raw) return { i: 0 };
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString()) as Cursor;
    return typeof c.i === "number" && c.i >= 0 ? c : { i: 0 };
  } catch {
    return { i: 0 };
  }
}

const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");

// What a user may read is decided by their signed session, never by query params.
function sourcesFor(user: { username: string; role: string; branches?: string[] }): Source[] {
  if (user.role === "superadmin" || user.role === "admin" || user.role === "developer") {
    return [{ type: "scan" }];
  }
  if (user.role === "manager") {
    return (user.branches ?? []).map((branch) => ({ type: "query" as const, branch }));
  }
  return [{ type: "query", branch: user.username }];
}

export async function GET(request: NextRequest) {
  try {
    const { user, denied } = requireRole(request);
    if (denied) return denied;

    const sources = sourcesFor(user);
    const cursor = decodeCursor(new URL(request.url).searchParams.get("cursor"));
    const source = sources[cursor.i];

    let items: FleetRow[] = [];
    let nextCursor: string | null = null;

    if (source) {
      const startKey = cursor.k ? { ExclusiveStartKey: cursor.k } : {};
      const result =
        source.type === "scan"
          ? await dynamo.send(
              new ScanCommand({ TableName: TABLE_NAME, Limit: PAGE_LIMIT, ...startKey })
            )
          : await dynamo.send(
              new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "pk = :pk",
                ExpressionAttributeValues: { ":pk": `BRANCH#${source.branch}` },
                Limit: PAGE_LIMIT,
                ...startKey,
              })
            );
      items = (result.Items ?? []) as FleetRow[];
      if (result.LastEvaluatedKey) {
        nextCursor = encodeCursor({ i: cursor.i, k: result.LastEvaluatedKey });
      } else if (cursor.i + 1 < sources.length) {
        nextCursor = encodeCursor({ i: cursor.i + 1 });
      }
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

    // DataManager expects a `files` array — derive it from unique _fileName values (this page only)
    const fileMap = new Map<string, { name: string; sha: string; download_url: string }>();
    items.forEach((item) => {
      const fn = (item as unknown as Record<string, string>)["_fileName"];
      if (fn && !fileMap.has(fn)) {
        fileMap.set(fn, { name: fn, sha: fn, download_url: "" });
      }
    });

    return NextResponse.json({ data: items, files: [...fileMap.values()], nextCursor });
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
    const { denied } = requireRole(request, UPLOAD_ROLES);
    if (denied) return denied;

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
        const left = await batchWriteWithRetry(
          TABLE_NAME,
          batch.map((key) => ({ DeleteRequest: { Key: { pk: key.pk, sk: key.sk } } }))
        );
        if (left > 0) throw new Error("DynamoDB throttled some deletes — try again");
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
        const left = await batchWriteWithRetry(
          TABLE_NAME,
          batch.map((item) => ({ DeleteRequest: { Key: { pk: item.pk, sk: item.sk } } }))
        );
        if (left > 0) throw new Error("DynamoDB throttled some deletes — try again");
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