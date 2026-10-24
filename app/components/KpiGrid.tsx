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
  const color = delta >= 0 ? "var(--green)" : "var(--red)";
  return (
    <span style={{ color, fontSize: 11, fontWeight: 600 }}>
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

  const marginColor = margin >= 30 ? "var(--green)" : margin >= 15 ? "var(--amber)" : "var(--red)";

  const cards: { label: string; value: string; color?: string; sub: React.ReactNode }[] = [
    {
      label: "Total Revenue",
      value: cr(revenue),
      sub: <>{activeVehicles} active vehicles<TrendArrow delta={momTrends?.revDelta ?? null} /></>,
    },
    {
      label: "Net Profit",
      value: cr(profit),
      color: profit >= 0 ? undefined : "var(--red)",
      sub: <>Active fleet only<TrendArrow delta={momTrends?.profDelta ?? null} /></>,
    },
    { label: "Profit Margin", value: `${margin.toFixed(1)}%`, color: marginColor, sub: "Profit ÷ revenue" },
    { label: "Total Expenses", value: cr(expenses), sub: "All vehicles, incl. idle" },
    {
      label: "Fleet Utilisation",
      value: uniqueVehicles > 0 ? `${((activeVehicles / uniqueVehicles) * 100).toFixed(1)}%` : "0%",
      sub: `${activeVehicles} of ${uniqueVehicles} vehicles earning · ${idleVehicles} idle`,
    },
  ];

  return (
    <div className="grid gap-3 mb-4 kpi-grid-resp" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
      {cards.map((c) => (
        <div
          key={c.label}
          className="min-w-0 rounded-lg"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px 16px" }}
        >
          <div className="text-xs font-medium mb-1.5 truncate" style={{ color: "var(--text3)" }}>{c.label}</div>
          <div
            className="font-semibold leading-tight truncate"
            style={{ color: c.color ?? "var(--text)", fontSize: "clamp(18px, 5vw, 24px)", letterSpacing: "-0.4px" }}
          >
            {c.value}
          </div>
          <div className="text-xs mt-1.5 flex flex-wrap items-center" style={{ color: "var(--text3)", columnGap: 4 }}>
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
