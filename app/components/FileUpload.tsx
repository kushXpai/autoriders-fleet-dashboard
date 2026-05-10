"use client";

import { useCallback } from "react";
import Papa from "papaparse";
import type { FleetRow } from "../lib/types";

interface Props {
  onDataLoaded: (data: FleetRow[]) => void;
}

export default function FileUpload({ onDataLoaded }: Props) {
  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "xlsx" || ext === "xls") {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(e.target?.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<FleetRow>(sheet, { defval: "" });
          const data = rows.filter((r) => r["Registration Number"] && String(r["Registration Number"]).trim());
          onDataLoaded(data);
        };
        reader.readAsArrayBuffer(file);
      } else {
        Papa.parse<FleetRow>(file, {
          header: true,
          skipEmptyLines: true,
          complete(results) {
            const data = results.data.filter(
              (r) => r["Registration Number"] && r["Registration Number"].trim()
            );
            onDataLoaded(data);
          },
        });
      }
    },
    [onDataLoaded]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            boxShadow: "0 0 20px rgba(59,130,246,0.4)",
          }}
        >
          <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
            <path d="M2 15l4-8 4 3 3-6 5 11H2z" fill="white" opacity=".9" />
          </svg>
        </div>
        <div>
          <h1
            className="syne text-2xl font-extrabold"
            style={{
              background: "linear-gradient(135deg, #0f1c2e, #3d5270)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Autoriders Fleet
          </h1>
          <p className="text-xs" style={{ color: "var(--text3)" }}>
            Fleet Intelligence Dashboard
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-8 w-full max-w-md text-center"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(37,99,235,0.07)",
        }}
      >
        <div
          className="mb-4 flex justify-center"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h2
          className="text-lg font-semibold mb-1"
          style={{ color: "var(--text)" }}
        >
          Upload Fleet Data
        </h2>
        <p className="text-sm mb-5" style={{ color: "var(--text3)" }}>
          Upload your CSV or Excel file with fleet data.
        </p>

        <label
          className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Choose File
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onInputChange}
          />
        </label>

        <div
          className="mt-4 rounded-xl p-4 text-xs"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            color: "var(--text3)",
          }}
        >
          Expected columns: Branch · Month · Year · Registration Number · Model · Registration Date · Total KMS ·
          Total Revenue · Total Cost · Profit · Fuel Cost · Repair Cost ·
          Chauffeur Cost · EMI
        </div>
      </div>
    </div>
  );
}
