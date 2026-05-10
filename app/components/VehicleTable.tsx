"use client";

import { useState, useMemo } from "react";
import type { FleetRow } from "../lib/types";
import { num, getVehicleAgeYears, aggregateByVehicle } from "../lib/dataUtils";

const PAGE_SIZE = 20;

function downloadCSV(data: FleetRow[]) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(","),
    ...data.map(row => keys.map(k => {
      const val = (row as unknown as Record<string, string>)[k] || "";
      return val.includes(",") ? `"${val}"` : val;
    }).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fleet-data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel(data: FleetRow[]) {
  if (!data.length) return;
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fleet Data");
  XLSX.writeFile(wb, "fleet-data.xlsx");
}

export default function VehicleTable({ data }: { data: FleetRow[] }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("Total Revenue");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);

  const aggregated = useMemo(() => aggregateByVehicle(data), [data]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(-1); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return aggregated.filter(r =>
      !q ||
      (r["Registration Number"] || "").toLowerCase().includes(q) ||
      (r.Model || "").toLowerCase().includes(q) ||
      (r["Registration Date"] || "").toLowerCase().includes(q)
    );
  }, [aggregated, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aRaw = (a as unknown as Record<string, string>)[sortCol] || "";
      const bRaw = (b as unknown as Record<string, string>)[sortCol] || "";
      const an = num(aRaw), bn = num(bRaw);
      if (an || bn) return (an - bn) * sortDir;
      return aRaw.localeCompare(bRaw) * sortDir;
    });
  }, [filtered, sortCol, sortDir]);

  const pages = Math.ceil(sorted.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);

  const Th = ({ label, col }: { label: string; col?: string }) => (
    <th
      className="text-left px-3.5 py-2.5 text-xs font-semibold uppercase tracking-widest whitespace-nowrap cursor-pointer select-none transition-colors"
      style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)", color: sortCol === col ? "var(--accent2)" : "var(--text3)" }}
      onClick={col ? () => handleSort(col) : undefined}
    >
      {label}{col ? " ↕" : ""}
    </th>
  );

  const pageNums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) pageNums.push(p);

  return (
    <div className="rounded-2xl overflow-hidden mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Vehicle Details</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{sorted.length} vehicles</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="table-search"
            type="text"
            placeholder="Search reg. no, model, fleet…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <button
            onClick={() => downloadCSV(sorted)}
            className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
          >
            ↓ CSV
          </button>
          <button
            onClick={() => downloadExcel(sorted)}
            className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
          >
            ↓ Excel
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th label="Reg. No" col="Registration Number" />
              <Th label="Model" col="Model" />
              <Th label="Reg. Date" col="Registration Date" />
              <Th label="Age" col="Registration Date" />
              <Th label="Total KMS" col="Total KMS" />
              <Th label="Revenue" col="Total Revenue" />
              <Th label="Cost" col="Total Cost" />
              <Th label="Profit" col="Profit" />
              <Th label="Margin" col="Profit %" />
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => {
              const rev = num(r["Total Revenue"]), prof = num(r.Profit), cost = num(r["Total Cost"]);
              const margin = r["Profit %"];
              const maxRev = 250000;
              const barW = Math.max(2, Math.min(80, rev / maxRev * 80));
              return (
                <tr key={i}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-3.5 py-2.5 text-xs font-mono font-bold" style={{ color: "var(--text)" }}>{r["Registration Number"] || "—"}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent2)" }}>
                      {r.Model || "—"}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>{r["Registration Date"] || "—"}</td>
                  <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>
                    {r["Registration Date"] ? `${getVehicleAgeYears(r["Registration Date"]).toFixed(1)} yrs` : "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>{num(r["Total KMS"]).toLocaleString("en-IN")}</td>
                  <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>
                    {rev > 0 ? "₹" + Math.round(rev).toLocaleString("en-IN") : <span style={{ color: "var(--text3)" }}>—</span>}
                  </td>
                  <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>
                    {cost > 0 ? "₹" + Math.round(cost).toLocaleString("en-IN") : <span style={{ color: "var(--text3)" }}>—</span>}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {rev > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className={`profit-bar${prof < 0 ? " neg" : ""}`} style={{ width: barW }} />
                        <span className="text-xs" style={{ color: prof >= 0 ? "var(--green)" : "var(--red)" }}>
                          ₹{Math.round(prof).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ) : <span style={{ color: "var(--text3)" }}>—</span>}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {margin ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={
                          parseFloat(margin) >= 30
                            ? { background: "var(--green-dim)", color: "var(--green)" }
                            : parseFloat(margin) < 0
                            ? { background: "var(--red-dim)", color: "#fca5a5" }
                            : { background: "var(--amber-dim)", color: "var(--amber)" }
                        }
                      >
                        {parseFloat(margin).toFixed(1)}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 flex justify-between items-center" style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
        <span className="text-xs" style={{ color: "var(--text3)" }}>
          Showing {start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length} vehicles
        </span>
        <div className="flex gap-1">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
          {pageNums.map(p => (
            <button key={p} className={`page-btn${p === page ? " active" : ""}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}
