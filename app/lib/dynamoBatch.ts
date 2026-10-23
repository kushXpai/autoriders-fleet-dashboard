// app/lib/dynamoBatch.ts
// BatchWrite helper that retries throttled (unprocessed) items with backoff.

import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "./dynamodb";

type WriteRequest = NonNullable<
  ConstructorParameters<typeof BatchWriteCommand>[0]["RequestItems"]
>[string][number];

const MAX_ATTEMPTS = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Writes up to 25 requests to a table, re-sending UnprocessedItems with
 * exponential backoff. Returns how many requests were still unprocessed
 * after all attempts (0 = everything was written).
 */
export async function batchWriteWithRetry(
  table: string,
  requests: WriteRequest[]
): Promise<number> {
  let pending = requests;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && pending.length > 0; attempt++) {
    if (attempt > 0) await sleep(100 * 2 ** attempt);
    const res = await dynamo.send(
      new BatchWriteCommand({ RequestItems: { [table]: pending } })
    );
    pending = (res.UnprocessedItems?.[table] as WriteRequest[] | undefined) ?? [];
  }
  return pending.length;
}
