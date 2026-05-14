"use client";

import { useState, useCallback } from "react";
import type { FleetRow } from "../lib/types";
import { getStoredUser } from "../lib/auth";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BRANCHES = [
  "Ahmedabad", "Bangalore", "Chennai", "Cochin", "Coimbatore",
  "Delhi", "Hyderabad", "Indore", "Jaipur", "Kolkatta",
  "Lucknow", "Mumbai", "Novotel", "Pune", "Vadodara",
  "Vizag", "Surat", "Bharuch", "Vijaywada", "Rajkot"
];

interface Props {
  onDataLoaded: (data: FleetRow[], file: File, filename: string) => void;
  uploading?: boolean;
}

export default function FileUpload({ onDataLoaded, uploading }: Props) {
  const user = getStoredUser();
  const isBranch = user?.role === "branch";

  const [branch, setBranch] = useState(isBranch ? (user?.username || "") : "");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const branchDisplay = branch.charAt(0).toUpperCase() + branch.slice(1);

  const handleSubmit = useCallback(() => {
    if (!file || !branch || !month || !year) return;

    const filename = `${branchDisplay}-${month}-${year}.xlsx`;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(e.target?.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<FleetRow>(sheet, { defval: "" });
        const data = rows.filter((r) => r["Registration Number"] && String(r["Registration Number"]).trim());
        onDataLoaded(data, file, filename);
      };
      reader.readAsArrayBuffer(file);
    } else {
      import("papaparse").then(({ default: Papa }) => {
        Papa.parse<FleetRow>(file, {
          header: true,
          skipEmptyLines: true,
          complete(results) {
            const data = results.data.filter(
              (r) => r["Registration Number"] && r["Registration Number"].trim()
            );
            onDataLoaded(data, file, filename);
          },
        });
      });
    }
  }, [file, branch, month, year, branchDisplay, onDataLoaded]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
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
        className="rounded-2xl p-8 w-full max-w-md"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(37,99,235,0.07)",
        }}
      >
        {uploading ? (
          <div className="text-center py-8">
            <div className="spinner mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
              Uploading...
            </h2>
            <p className="text-sm" style={{ color: "var(--text3)" }}>
              Saving as <span className="font-mono font-semibold">{branchDisplay}-{month}-{year}.xlsx</span>
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
              Upload Fleet Data
            </h2>
            <p className="text-sm mb-5" style={{ color: "var(--text3)" }}>
              Select branch, month, year and upload your file.
            </p>

            {/* Branch */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text3)" }}>
                Branch
              </label>
              {isBranch ? (
                <div className="px-3 py-2.5 rounded-lg text-sm font-medium capitalize" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  {branchDisplay}
                </div>
              ) : (
                <select
                  className="fleet-select w-full"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="">Select branch</option>
                  {BRANCHES.map(b => (
                    <option key={b} value={b.toLowerCase()}>{b}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Month + Year row */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text3)" }}>
                  Month
                </label>
                <select
                  className="fleet-select w-full"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  <option value="">Select month</option>
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text3)" }}>
                  Year
                </label>
                <select
                  className="fleet-select w-full"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text3)" }}>
                File
              </label>
              <div
                className="rounded-xl p-5 text-center cursor-pointer transition-colors"
                style={{ background: "var(--surface2)", border: "2px dashed var(--border2)" }}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{file.name}</span>
                  </div>
                ) : (
                  <>
                    <svg className="mx-auto mb-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      Drop file here or click to browse
                    </p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                />
              </div>
            </div>

            {/* File will be named as */}
            {branch && month && year && (
              <div className="mb-5 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--accent-glow)", color: "var(--accent2)", border: "1px solid rgba(59,130,246,0.2)" }}>
                File will be saved as: <span className="font-mono font-bold">{branchDisplay}-{month}-{year}.xlsx</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!file || !branch || !month || !year}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Upload & Save
            </button>

            <div
              className="mt-4 rounded-xl p-3 text-xs"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text3)" }}
            >
              Expected columns: Branch · Month · Year · Registration Number · Model · Registration Date · Total KMS ·
              Total Revenue · Total Cost · Profit · Fuel Cost · Repair Cost · Chauffeur Cost · EMI
            </div>
          </>
        )}
      </div>
    </div>
  );
}
