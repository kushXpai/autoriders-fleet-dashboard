// app/components/DeleteDataPanel.tsx
"use client";

import { useState, useMemo } from "react";
import type { FleetRow } from "../lib/types";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

function getFYStart(month: string, year: string): number {
  const y = parseInt(year, 10) || 0;
  return MONTH_ORDER.indexOf(month) <= 8 ? y : y - 1;
}

interface Props {
  allData: FleetRow[];
  onDeleted: () => void;
}

export default function DeleteDataPanel({ allData, onDeleted }: Props) {
  const [branch, setBranch] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const branches = useMemo(
    () => [...new Set(allData.map((r) => r.Branch).filter(Boolean))].sort(),
    [allData]
  );

  const monthYears = useMemo(() => {
    if (!branch) return [];
    const pairs = new Set<string>();
    allData
      .filter((r) => r.Branch === branch)
      .forEach((r) => {
        if (r.Month && r.Year) pairs.add(`${r.Month}|${r.Year}`);
      });
    return [...pairs].sort((a, b) => {
      const [am, ay] = a.split("|");
      const [bm, by] = b.split("|");
      const afy = getFYStart(am, ay), bfy = getFYStart(bm, by);
      if (afy !== bfy) return afy - bfy;
      return MONTH_ORDER.indexOf(am) - MONTH_ORDER.indexOf(bm);
    });
  }, [allData, branch]);

  const rowCount = useMemo(() => {
    if (!branch || !monthYear) return 0;
    const [month, year] = monthYear.split("|");
    return allData.filter(
      (r) => r.Branch === branch && r.Month === month && r.Year === year
    ).length;
  }, [allData, branch, monthYear]);

  const reset = () => {
    setBranch("");
    setMonthYear("");
    setConfirming(false);
    setResult(null);
  };

  const handleDelete = async () => {
    if (!branch || !monthYear) return;
    const [month, year] = monthYear.split("|");
    setDeleting(true);
    setResult(null);
    try {
      const res = await fetch("/api/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, month, year }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setResult({
        ok: true,
        msg: `Deleted ${json.deleted} rows for ${branch.charAt(0).toUpperCase() + branch.slice(1)} — ${month} ${year}.`,
      });
      setConfirming(false);
      setBranch("");
      setMonthYear("");
      onDeleted();
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div
      className="rounded-2xl p-5 mb-3.5"
      style={{ background: "var(--surface)", border: "1px solid rgba(220,38,38,0.2)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Delete Fleet Data
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            Permanently remove all records for a selected branch and month
          </div>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(220,38,38,0.08)",
            color: "#dc2626",
            border: "1px solid rgba(220,38,38,0.2)",
          }}
        >
          Superadmin only
        </span>
      </div>

      {/* Selectors */}
      {!confirming && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Branch */}
          <select
            className="fleet-select"
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setMonthYear("");
              setResult(null);
            }}
          >
            <option value="">Select Branch</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {cap(b)}
              </option>
            ))}
          </select>

          {/* Month + Year */}
          <select
            className="fleet-select"
            value={monthYear}
            onChange={(e) => { setMonthYear(e.target.value); setResult(null); }}
            disabled={!branch}
          >
            <option value="">Select Month</option>
            {monthYears.map((my) => {
              const [m, y] = my.split("|");
              return (
                <option key={my} value={my}>
                  {m} {y}
                </option>
              );
            })}
          </select>

          {/* Row count */}
          {branch && monthYear && (
            <span className="text-xs font-medium" style={{ color: "var(--text3)" }}>
              {rowCount} rows will be deleted
            </span>
          )}

          {/* Delete trigger */}
          <button
            onClick={() => setConfirming(true)}
            disabled={!branch || !monthYear}
            className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
            style={{
              background: "rgba(220,38,38,0.08)",
              color: "#dc2626",
              border: "1px solid rgba(220,38,38,0.3)",
            }}
          >
            Delete →
          </button>
        </div>
      )}

      {/* Confirmation step */}
      {confirming && (
        <div
          className="rounded-xl px-5 py-4 flex items-start justify-between gap-4 flex-wrap"
          style={{
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
          }}
        >
          <div>
            <div className="text-sm font-semibold mb-1" style={{ color: "#dc2626" }}>
              Confirm deletion
            </div>
            <div className="text-xs" style={{ color: "#7f1d1d" }}>
              This will permanently delete{" "}
              <strong>{rowCount} rows</strong> for{" "}
              <strong>{cap(branch)}</strong> —{" "}
              <strong>{monthYear.replace("|", " ")}</strong>.{" "}
              This cannot be undone.
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-60"
              style={{ background: "#dc2626", color: "#fff", border: "none" }}
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="text-xs font-semibold px-4 py-2 rounded-lg"
              style={{
                background: "var(--surface2)",
                color: "var(--text2)",
                border: "1px solid var(--border2)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div
          className="mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium"
          style={{
            background: result.ok ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.08)",
            color: result.ok ? "#059669" : "#dc2626",
            border: `1px solid ${result.ok ? "rgba(16,185,129,0.2)" : "rgba(220,38,38,0.2)"}`,
          }}
        >
          <span>{result.msg}</span>
          <button
            onClick={() => setResult(null)}
            className="ml-4 opacity-60 hover:opacity-100"
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
