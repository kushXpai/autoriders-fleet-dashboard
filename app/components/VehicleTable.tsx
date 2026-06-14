// app/components/VehicleTable.tsx
"use client";

import { useState, useMemo } from "react";
import type { FleetRow } from "../lib/types";
import { num } from "../lib/dataUtils";

const PAGE_SIZE = 20;

interface AggRow {
  reg: string;
  model: string;
  branch: string;
  totalKms: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  months: number;
  monthList: string[];
  rows: FleetRow[];
}

function aggregateRows(data: FleetRow[]): AggRow[] {
  const map = new Map<string, AggRow>();
  data.forEach(r => {
    const reg = r["Registration Number"] || "—";
    if (!map.has(reg)) {
      map.set(reg, {
        reg,
        model: r.Model || "—",
        branch: r.Branch || "—",
        totalKms: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        months: 0,
        monthList: [],
        rows: [],
      });
    }
    const agg = map.get(reg)!;
    agg.totalKms += num(r["Total KMS"]);
    agg.totalRevenue += num(r["Total Revenue"]);
    agg.totalCost += num(r["Total Cost"]);
    agg.totalProfit += num(r["Profit"]);
    agg.months += 1;
    if (r.Month && r.Year) agg.monthList.push(`${r.Month.substring(0, 3)}-${r.Year.slice(2)}`);
    agg.rows.push(r);
  });
  return [...map.values()];
}

function downloadCSV(data: AggRow[]) {
  const headers = ["Reg. Number", "Model", "Branch", "Months", "Total KMS", "Total Revenue", "Total Cost", "Total Profit", "Margin %"];
  const rows = data.map(r => {
    const margin = r.totalRevenue > 0 ? (r.totalProfit / r.totalRevenue * 100).toFixed(1) : "0";
    return [r.reg, r.model, r.branch, r.months, r.totalKms, r.totalRevenue, r.totalCost, r.totalProfit, margin];
  });
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "fleet-data.csv"; a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel(data: AggRow[]) {
  const XLSX = await import("xlsx");
  const rows = data.map(r => ({
    "Reg. Number": r.reg, Model: r.model, Branch: r.branch, Months: r.months,
    "Total KMS": r.totalKms, "Total Revenue": r.totalRevenue, "Total Cost": r.totalCost,
    "Total Profit": r.totalProfit,
    "Margin %": r.totalRevenue > 0 ? +(r.totalProfit / r.totalRevenue * 100).toFixed(1) : 0,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fleet Data");
  XLSX.writeFile(wb, "fleet-data.xlsx");
}

const MONTH_ORDER = [
  "April","May","June","July","August","September",
  "October","November","December","January","February","March",
];

function sortMonthRows(rows: FleetRow[]): FleetRow[] {
  return [...rows].sort((a, b) => {
    const ay = parseInt(a.Year || "0", 10), by = parseInt(b.Year || "0", 10);
    const am = MONTH_ORDER.indexOf(a.Month || ""), bm = MONTH_ORDER.indexOf(b.Month || "");
    if (ay !== by) return ay - by;
    return am - bm;
  });
}

function ExpandedRows({ rows }: { rows: FleetRow[] }) {
  const sorted = sortMonthRows(rows);
  return (
    <>
      {sorted.map((r, i) => {
        const rev = num(r["Total Revenue"]);
        const prof = num(r["Profit"]);
        const cost = num(r["Total Cost"]);
        const margin = rev > 0 ? (prof / rev * 100).toFixed(1) : null;
        return (
          <tr key={i} style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
            <td className="px-3.5 py-2 text-xs" style={{ color: "var(--text3)", paddingLeft: "2.5rem" }}>
              ↳ {r.Month} {r.Year}
            </td>
            <td className="px-3.5 py-2 text-xs" style={{ color: "var(--text3)" }}>{r.Branch || "—"}</td>
            <td className="px-3.5 py-2 text-xs" style={{ color: "var(--text2)" }}>{num(r["Total KMS"]).toLocaleString("en-IN")}</td>
            <td className="px-3.5 py-2 text-xs" style={{ color: "var(--text2)" }}>
              {rev > 0 ? "₹" + Math.round(rev).toLocaleString("en-IN") : <span style={{ color: "var(--text3)" }}>—</span>}
            </td>
            <td className="px-3.5 py-2 text-xs" style={{ color: "var(--text2)" }}>
              {cost > 0 ? "₹" + Math.round(cost).toLocaleString("en-IN") : <span style={{ color: "var(--text3)" }}>—</span>}
            </td>
            <td className="px-3.5 py-2 text-xs" style={{ color: prof >= 0 ? "var(--green)" : "var(--red)" }}>
              {rev > 0 ? "₹" + Math.round(prof).toLocaleString("en-IN") : <span style={{ color: "var(--text3)" }}>—</span>}
            </td>
            <td className="px-3.5 py-2 text-xs">
              {margin ? (
                <span className="font-semibold px-2 py-0.5 rounded-full text-xs"
                  style={
                    parseFloat(margin) >= 30
                      ? { background: "var(--green-dim)", color: "var(--green)" }
                      : parseFloat(margin) < 0
                      ? { background: "var(--red-dim)", color: "#fca5a5" }
                      : { background: "var(--amber-dim)", color: "var(--amber)" }
                  }
                >
                  {margin}%
                </span>
              ) : "—"}
            </td>
          </tr>
        );
      })}
    </>
  );
}

export default function VehicleTable({ data }: { data: FleetRow[] }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<keyof AggRow>("totalRevenue");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleSort = (col: keyof AggRow) => {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(-1); }
    setPage(1);
  };

  const toggleExpand = (reg: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(reg) ? next.delete(reg) : next.add(reg);
      return next;
    });
  };

  const aggregated = useMemo(() => aggregateRows(data), [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return aggregated.filter(r =>
      !q ||
      r.reg.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q) ||
      r.branch.toLowerCase().includes(q)
    );
  }, [aggregated, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }, [filtered, sortCol, sortDir]);

  const pages = Math.ceil(sorted.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);

  const Th = ({ label, col }: { label: string; col?: keyof AggRow }) => (
    <th
      className="text-left px-3.5 py-2.5 text-xs font-semibold uppercase tracking-widest whitespace-nowrap cursor-pointer select-none transition-colors"
      style={{
        background: "var(--surface2)",
        borderBottom: "1px solid var(--border)",
        color: sortCol === col ? "var(--accent2)" : "var(--text3)",
      }}
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
          <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            {sorted.length} unique vehicles · click row to expand months
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="table-search"
            type="text"
            placeholder="Search registration, model, branch…"
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
              <Th label="Reg. Number" col="reg" />
              <Th label="Model" col="model" />
              <Th label="Total KMS" col="totalKms" />
              <Th label="Revenue" col="totalRevenue" />
              <Th label="Cost" col="totalCost" />
              <Th label="Profit" col="totalProfit" />
              <Th label="Margin" />
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const margin = r.totalRevenue > 0 ? (r.totalProfit / r.totalRevenue * 100) : null;
              const maxRev = 3000000;
              const barW = Math.max(2, Math.min(80, r.totalRevenue / maxRev * 80));
              const isOpen = expanded.has(r.reg);

              return (
                <>
                  <tr
                    key={r.reg}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                    onClick={() => toggleExpand(r.reg)}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = isOpen ? "var(--accent-glow)" : "transparent")}
                  >
                    <td className="px-3.5 py-2.5 text-xs font-mono font-bold" style={{ color: "var(--text)" }}>
                      <span style={{ marginRight: 6, color: "var(--text3)", fontSize: 10 }}>{isOpen ? "▼" : "▶"}</span>
                      {r.reg}
                      <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)", fontSize: 9 }}>
                        {r.months}mo
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent2)" }}>
                        {r.model}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>
                      {r.totalKms.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>
                      {r.totalRevenue > 0 ? "₹" + Math.round(r.totalRevenue).toLocaleString("en-IN") : <span style={{ color: "var(--text3)" }}>—</span>}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs" style={{ color: "var(--text2)" }}>
                      {r.totalCost > 0 ? "₹" + Math.round(r.totalCost).toLocaleString("en-IN") : <span style={{ color: "var(--text3)" }}>—</span>}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {r.totalRevenue > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className={`profit-bar${r.totalProfit < 0 ? " neg" : ""}`} style={{ width: barW }} />
                          <span className="text-xs" style={{ color: r.totalProfit >= 0 ? "var(--green)" : "var(--red)" }}>
                            ₹{Math.round(r.totalProfit).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ) : <span style={{ color: "var(--text3)" }}>—</span>}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {margin !== null ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={
                            margin >= 30
                              ? { background: "var(--green-dim)", color: "var(--green)" }
                              : margin < 0
                              ? { background: "var(--red-dim)", color: "#fca5a5" }
                              : { background: "var(--amber-dim)", color: "var(--amber)" }
                          }
                        >
                          {margin.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                  {isOpen && <ExpandedRows rows={r.rows} />}
                </>
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