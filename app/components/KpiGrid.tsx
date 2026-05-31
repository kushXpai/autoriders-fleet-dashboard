// app/components/KpiGrid.tsx
"use client";

import type { FleetRow } from "../lib/types";
import { num, cr } from "../lib/dataUtils";

interface Props {
  data: FleetRow[];
}

export default function KpiGrid({ data }: Props) {
  const active = data.filter((r) => num(r["Total Revenue"]) > 0);
  const revenue = active.reduce((s, r) => s + num(r["Total Revenue"]), 0);
  const profit = active.reduce((s, r) => s + num(r["Profit"]), 0);
  const expenses = active.reduce((s, r) => s + num(r["Total Cost"]), 0);
  const margin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : "0";

  const uniqueVehicles = new Set(data.map((r) => r["Registration Number"])).size;
  const activeVehicles = new Set(active.map((r) => r["Registration Number"])).size;
  const idleVehicles = uniqueVehicles - activeVehicles;

  const cards = [
    { label: "Total Revenue", value: cr(revenue), sub: `${activeVehicles} active vehicles` },
    { label: "Net Profit", value: cr(profit), sub: `${margin}% overall margin` },
    { label: "Total Expenses", value: cr(expenses), sub: "fuel + repair + chauffeur + EMI" },
    { label: "Fleet Size", value: String(uniqueVehicles), sub: `${activeVehicles} active · ${idleVehicles} idle` },
  ];

  return (
    <div
      className="grid gap-3.5 mb-5 kpi-grid-resp"
      style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl p-5 relative overflow-hidden transition-all duration-200 hover:-translate-y-px"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--text3)" }}
          >
            {card.label}
          </div>
          <div
            className="text-2xl font-bold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.8px" }}
          >
            {card.value}
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--text3)" }}>
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  );
}