// app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE_NAME } from "../../lib/dynamodb";
import * as XLSX from "xlsx";

const BATCH_SIZE = 25;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function buildKeys(row: Record<string, string>, rowIndex: number) {
  // Branch must be lowercase to match auth.ts credentials (e.g. "bangalore" not "BANGALORE")
  const branch = (row["Branch"] || "Unknown").trim().toLowerCase();
  const year = (row["Year"] || "Unknown").trim();
  const month = (row["Month"] || "Unknown").trim();
  const regNo = (row["Registration Number"] || "").replace(/[^a-zA-Z0-9\-]/g, "_");
  const srNo = row["Sr. No"] || String(rowIndex + 1);
  return {
    pk: `BRANCH#${branch}`,
    sk: `${year}#${month}#${regNo}#${srNo}`,
    month_year: `${year}#${month}`,
  };
}

async function writeBatch(items: Record<string, unknown>[]): Promise<number> {
  const requests = items.map((item) => ({ PutRequest: { Item: item } }));
  const result = await dynamo.send(
    new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: requests } })
  );
  return result.UnprocessedItems?.[TABLE_NAME]?.length ?? 0;
}

// Check if any items already exist for this branch+month+year combination
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
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    // Optional flag: if "overwrite=true" is passed, skip the duplicate check
    const overwrite = formData.get("overwrite") === "true";

    if (!files || files.length === 0) {
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
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false,
        });

        // Normalize text fields to uppercase EXCEPT Branch (must stay lowercase to match auth)
        const normalizedRows = rows.map((row) => {
          const clean: Record<string, string> = {};
          for (const key in row) {
            const val = row[key];
            if (key === "Branch") {
              // Keep Branch lowercase so it matches auth.ts credentials and DynamoDB pk
              clean[key] = typeof val === "string" ? val.trim().toLowerCase() : val;
            } else if (typeof val === "string" && isNaN(Number(val)) && val.trim() !== "") {
              clean[key] = val.trim().toUpperCase();
            } else {
              clean[key] = typeof val === "string" ? val.trim() : val;
            }
          }
          return clean;
        });

        const validRows = normalizedRows.filter(
          (r) => r["Registration Number"] && String(r["Registration Number"]).trim()
        );

        if (validRows.length === 0) {
          errors.push(`"${file.name}" had no valid rows — check the Registration Number column`);
          continue;
        }

        // Detect duplicate: check branch+month+year from the first valid row
        if (!overwrite) {
          const sample = validRows[0];
          const branch = (sample["Branch"] || "Unknown").trim(); // already lowercase from above
          const month = (sample["Month"] || "Unknown").trim();
          const year = (sample["Year"] || "Unknown").trim();

          const exists = await alreadyExists(branch, month, year);
          if (exists) {
            duplicates.push(`${branch} — ${month} ${year}`);
            continue;
          }
        }

        const items = validRows.map((row, index) => ({
          ...buildKeys(row, index),
          ...row,
          _uploadedAt: new Date().toISOString(),
          _fileName: file.name,
        }));

        const batches = chunk(items, BATCH_SIZE);
        for (const batch of batches) {
          const unprocessed = await writeBatch(batch);
          totalInserted += batch.length - unprocessed;
          if (unprocessed > 0) {
            errors.push(
              `${unprocessed} items from "${file.name}" were not written — DynamoDB throttled them. Re-upload the file.`
            );
          }
        }
      } catch (fileErr) {
        errors.push(`Failed to process "${file.name}": ${(fileErr as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: "Upload failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}