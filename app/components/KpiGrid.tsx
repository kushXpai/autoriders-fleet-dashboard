// app/components/KpiGrid.tsx
"use client";

import { useMemo } from "react";
import type { FleetRow } from "../lib/types";
import { num, cr } from "../lib/dataUtils";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

function getFYStart(month: string, year: string): number {
  const y = parseInt(year, 10) || 0;
  return MONTH_ORDER.indexOf(month) <= 8 ? y : y - 1;
}

function TrendArrow({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const color = delta >= 0 ? "#10b981" : "#ef4444";
  return (
    <span style={{ color, fontSize: 10, fontWeight: 700, marginLeft: 5 }}>
      {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

export default function KpiGrid({ data }: { data: FleetRow[] }) {
  const active = data.filter((r) => num(r["Total Revenue"]) > 0);
  const revenue = active.reduce((s, r) => s + num(r["Total Revenue"]), 0);
  const profit = active.reduce((s, r) => s + num(r["Profit"]), 0);
  // #1: expenses from ALL vehicles — idle still incur EMI/costs
  const expenses = data.reduce((s, r) => s + num(r["Total Cost"]), 0);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const uniqueVehicles = new Set(data.map((r) => r["Registration Number"])).size;
  const activeVehicles = new Set(active.map((r) => r["Registration Number"])).size;
  const idleVehicles = uniqueVehicles - activeVehicles;

  // #2: MoM trend — compare last two months present in the dataset
  const momTrends = useMemo(() => {
    const byMonth = new Map<string, { revenue: number; profit: number }>();
    data.forEach((r) => {
      if (!r.Month || !r.Year) return;
      const key = `${r.Month}|${r.Year}`;
      const e = byMonth.get(key) || { revenue: 0, profit: 0 };
      e.revenue += num(r["Total Revenue"]);
      e.profit += num(r["Profit"]);
      byMonth.set(key, e);
    });
    const sorted = [...byMonth.entries()].sort((a, b) => {
      const [am, ay] = a[0].split("|"), [bm, by] = b[0].split("|");
      const afy = getFYStart(am, ay), bfy = getFYStart(bm, by);
      if (afy !== bfy) return afy - bfy;
      return MONTH_ORDER.indexOf(am) - MONTH_ORDER.indexOf(bm);
    });
    if (sorted.length < 2) return null;
    const prev = sorted[sorted.length - 2][1];
    const curr = sorted[sorted.length - 1][1];
    const currLabel = sorted[sorted.length - 1][0].split("|")[0].substring(0, 3);
    return {
      revDelta: prev.revenue > 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : null,
      profDelta: prev.profit !== 0 ? ((curr.profit - prev.profit) / Math.abs(prev.profit)) * 100 : null,
      currLabel,
    };
  }, [data]);

  // #3: margin colour
  const marginColor = margin >= 30 ? "#10b981" : margin >= 15 ? "#f59e0b" : "#ef4444";

  const cardBase: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 20,
    transition: "transform 0.2s",
  };

  return (
    <div className="grid gap-3.5 mb-5 kpi-grid-resp" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>

      {/* Revenue */}
      <div style={cardBase} className="hover:-translate-y-px">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text3)" }}>Total Revenue</div>
        <div className="text-2xl font-bold leading-none" style={{ color: "var(--text)", letterSpacing: "-0.8px" }}>{cr(revenue)}</div>
        <div className="text-xs mt-2 flex items-center" style={{ color: "var(--text3)" }}>
          {activeVehicles} active vehicles
          <TrendArrow delta={momTrends?.revDelta ?? null} />
        </div>
      </div>

      {/* Net Profit */}
      <div style={cardBase} className="hover:-translate-y-px">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text3)" }}>Net Profit</div>
        <div className="text-2xl font-bold leading-none" style={{ color: profit >= 0 ? "var(--text)" : "#ef4444", letterSpacing: "-0.8px" }}>{cr(profit)}</div>
        <div className="text-xs mt-2 flex items-center" style={{ color: "var(--text3)" }}>
          active fleet only
          <TrendArrow delta={momTrends?.profDelta ?? null} />
        </div>
      </div>

      {/* #3 Profit Margin — own card */}
      <div style={cardBase} className="hover:-translate-y-px">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text3)" }}>Profit Margin</div>
        <div className="text-2xl font-bold leading-none" style={{ color: marginColor, letterSpacing: "-0.8px" }}>{margin.toFixed(1)}%</div>
        <div className="text-xs mt-2" style={{ color: "var(--text3)" }}>revenue → profit ratio</div>
      </div>

      {/* Expenses — all vehicles */}
      <div style={cardBase} className="hover:-translate-y-px">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text3)" }}>Total Expenses</div>
        <div className="text-2xl font-bold leading-none" style={{ color: "var(--text)", letterSpacing: "-0.8px" }}>{cr(expenses)}</div>
        <div className="text-xs mt-2" style={{ color: "var(--text3)" }}>all vehicles incl. idle EMI</div>
      </div>

      {/* Fleet Size */}
      <div style={cardBase} className="hover:-translate-y-px">
        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text3)" }}>Fleet Size</div>
        <div className="text-2xl font-bold leading-none" style={{ color: "var(--text)", letterSpacing: "-0.8px" }}>{uniqueVehicles}</div>
        <div className="text-xs mt-2" style={{ color: "var(--text3)" }}>
          <span style={{ color: "#10b981", fontWeight: 600 }}>{activeVehicles} active</span>
          {" · "}
          <span style={{ color: idleVehicles > 0 ? "#f59e0b" : "var(--text3)", fontWeight: idleVehicles > 0 ? 600 : 400 }}>
            {idleVehicles} idle
          </span>
        </div>
      </div>

    </div>
  );
}
