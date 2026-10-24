// app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE_NAME } from "../../lib/dynamodb";
import { batchWriteWithRetry, chunk } from "../../lib/dynamoBatch";
import { requireRole, UPLOAD_ROLES } from "../../lib/session";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const BATCH_SIZE = 25;
const WRITE_CONCURRENCY = 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Required headers must match exactly (case-sensitive) — a mismatched name means the
// file is rejected rather than guessed at. Only stray leading/trailing spaces are tolerated.
const REQUIRED_HEADERS = ["Branch", "Month", "Year", "Registration Number"];

function canonicalHeader(header: string): string {
  return header.trim();
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "apr", "Sept", "APRIL" → "April"; anything else → null
function canonicalMonth(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v.length < 3) return null;
  return MONTHS.find((m) => m.toLowerCase() === v || (v.length === 3 && m.toLowerCase().startsWith(v)) || (v === "sept" && m === "September")) ?? null;
}

// Columns the dashboard does arithmetic on. Excel exports format these for display
// ("1,23,456", "₹5,000", "(2,300)", "12.5%"), which parseFloat would silently misread.
const NUMERIC_COLUMNS = new Set([
  "Opening KMS", "Closing KMS", "Total KMS", "CD Kms", "SD Kms", "STR Kms", "Revenue KMS", "NRK",
  "CD Revenue", "SD Revenue", "STR Revenue", "Total Revenue",
  "Fuel Cost", "Repair Cost", "Chauffeur Cost", "EMI", "Total Cost", "Profit", "Profit %", "Year",
]);

function cleanNumber(val: string): string {
  if (val === "" || val === "-" || val === "—") return "0";
  const negative = /^\(.*\)$/.test(val) || /^[^0-9]*-/.test(val);
  const digits = val.replace(/[^0-9.]/g, "");
  if (digits === "" || isNaN(Number(digits))) return val;
  return (negative ? "-" : "") + digits;
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const rawKey in row) {
    const key = canonicalHeader(rawKey);
    if (!key || key.startsWith("__EMPTY")) continue;
    const raw = row[rawKey];
    const val = typeof raw === "string" ? raw.trim() : String(raw ?? "");
    if (key === "Branch") {
      clean[key] = val.toLowerCase();
    } else if (key === "Month") {
      clean[key] = canonicalMonth(val) ?? titleCase(val);
    } else if (NUMERIC_COLUMNS.has(key)) {
      clean[key] = cleanNumber(val);
    } else if (val !== "" && isNaN(Number(val))) {
      // Uppercase text to prevent model-name casing duplicates
      clean[key] = val.toUpperCase();
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

function buildKeys(row: Record<string, string>, rowIndex: number) {
  const branch = row["Branch"];
  const year = row["Year"];
  const month = row["Month"];
  const regNo = (row["Registration Number"] || "").replace(/[^a-zA-Z0-9\-]/g, "_");
  const srNo = row["Sr. No"] || String(rowIndex + 1);
  return {
    pk: `BRANCH#${branch}`,
    sk: `${year}#${month}#${regNo}#${srNo}`,
    month_year: `${year}#${month}`,
  };
}

// Fetch all keys for a given branch+month+year so we can delete them before re-inserting
async function fetchKeysForMonth(
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
    if (result.Items) {
      keys.push(...(result.Items as { pk: string; sk: string }[]));
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return keys;
}

async function deleteKeys(keys: { pk: string; sk: string }[]): Promise<void> {
  for (const batch of chunk(keys, BATCH_SIZE)) {
    const left = await batchWriteWithRetry(
      TABLE_NAME,
      batch.map((key) => ({ DeleteRequest: { Key: { pk: key.pk, sk: key.sk } } }))
    );
    if (left > 0) throw new Error("Could not clear old records (DynamoDB throttled). Try again.");
  }
}

async function alreadyExists(branch: string, month: string, year: string): Promise<boolean> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `BRANCH#${branch}`,
        ":prefix": `${year}#${month}#`,
      },
      Limit: 1,
      Select: "COUNT",
    })
  );
  return (result.Count ?? 0) > 0;
}

export async function POST(request: NextRequest) {
  try {
    const { denied } = requireRole(request, UPLOAD_ROLES);
    if (denied) return denied;

    const formData = await request.formData();
    const files = formData.getAll("files").filter((f): f is File => typeof f !== "string");
    const overwrite = formData.get("overwrite") === "true";

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the 10 MB limit` },
          { status: 400 }
        );
      }
    }

    let totalInserted = 0;
    const errors: string[] = [];
    const duplicates: string[] = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
          errors.push(`"${file.name}" has no readable sheet`);
          continue;
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });

        const headers = new Set(Object.keys(rows[0] ?? {}).map(canonicalHeader));
        const missing = REQUIRED_HEADERS.filter((h) => !headers.has(h));
        if (missing.length > 0) {
          errors.push(
            `"${file.name}": missing required column(s) ${missing.map((m) => `"${m}"`).join(", ")}. ` +
              `Headers must match exactly. Columns found: ${[...headers].filter(Boolean).join(", ") || "none"}`
          );
          continue;
        }

        const normalized = rows.map(normalizeRow);
        const withReg = normalized.filter((r) => r["Registration Number"]);

        if (withReg.length === 0) {
          const found = Object.keys(rows[0] ?? {}).join(", ") || "none";
          errors.push(
            `"${file.name}": no rows with a Registration Number. Columns found: ${found}`
          );
          continue;
        }

        // Rows must carry Branch / Month / Year — they form the storage key
        const validRows = withReg.filter((r) => r["Branch"] && r["Month"] && r["Year"]);
        const skipped = withReg.length - validRows.length;
        if (skipped > 0) {
          errors.push(
            `"${file.name}": ${skipped} row(s) skipped — Branch, Month and Year are required on every row`
          );
        }
        if (validRows.length === 0) continue;

        const badMonths = [...new Set(validRows.map((r) => r["Month"]).filter((m) => !MONTHS.includes(m)))];
        if (badMonths.length > 0) {
          errors.push(
            `"${file.name}": unrecognised Month value(s) ${badMonths.map((m) => `"${m}"`).join(", ")} — use full month names such as "April"`
          );
          continue;
        }

        // A file may contain several branch/month/year combinations — handle each separately
        const groups = new Map<string, Record<string, string>[]>();
        for (const row of validRows) {
          const gk = `${row["Branch"]}|${row["Month"]}|${row["Year"]}`;
          const list = groups.get(gk);
          if (list) list.push(row);
          else groups.set(gk, [row]);
        }

        const uploadedAt = new Date().toISOString();

        for (const [gk, groupRows] of groups) {
          const [branch, month, year] = gk.split("|");
          const exists = await alreadyExists(branch, month, year);

          if (exists && !overwrite) {
            duplicates.push(`${branch} — ${month} ${year}`);
            continue;
          }
          // Guarantee unique sort keys — a duplicate key makes DynamoDB reject the whole batch
          const seen = new Set<string>();
          const items = groupRows.map((row, index) => {
            const keys = buildKeys(row, index);
            let sk = keys.sk;
            for (let n = 2; seen.has(sk); n++) sk = `${keys.sk}-${n}`;
            seen.add(sk);
            return { ...row, ...keys, sk, _uploadedAt: uploadedAt, _fileName: file.name };
          });

          // Write the new rows first (several batches at a time) …
          let groupFailed = 0;
          for (const wave of chunk(chunk(items, BATCH_SIZE), WRITE_CONCURRENCY)) {
            const lefts = await Promise.all(
              wave.map((batch) =>
                batchWriteWithRetry(TABLE_NAME, batch.map((item) => ({ PutRequest: { Item: item } })))
              )
            );
            wave.forEach((batch, i) => {
              totalInserted += batch.length - lefts[i];
              groupFailed += lefts[i];
            });
          }
          if (groupFailed > 0) {
            // … and keep the old records if the write was incomplete, so nothing is lost
            errors.push(
              `${groupFailed} items from "${file.name}" (${branch} ${month} ${year}) were not written — DynamoDB throttled them. Re-upload the file.`
            );
            continue;
          }

          // … then remove only the old rows that the new file no longer contains,
          // so corrected/removed vehicles don't leave ghosts behind.
          if (exists) {
            const stale = (await fetchKeysForMonth(branch, month, year)).filter((k) => !seen.has(k.sk));
            await deleteKeys(stale);
          }
        }
      } catch (fileErr) {
        errors.push(`Failed to process "${file.name}": ${(fileErr as Error).message}`);
      }
    }

    const failedCompletely = totalInserted === 0 && duplicates.length === 0 && errors.length > 0;

    return NextResponse.json(
      {
        success: !failedCompletely,
        inserted: totalInserted,
        duplicates: duplicates.length > 0 ? duplicates : undefined,
        errors: errors.length > 0 ? errors : undefined,
        error: failedCompletely ? errors.join(" | ") : undefined,
      },
      { status: failedCompletely ? 422 : 200 }
    );
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: "Upload failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}
