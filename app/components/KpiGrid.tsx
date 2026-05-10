"use client";

import type { FleetRow } from "../lib/types";
import { num, cr, getVehicleAgeYears } from "../lib/dataUtils";

interface Props {
  data: FleetRow[];
}

export default function KpiGrid({ data }: Props) {
  const active = data.filter((r) => num(r["Total Revenue"]) > 0);
  const revenue = active.reduce((s, r) => s + num(r["Total Revenue"]), 0);
  const profit = active.reduce((s, r) => s + num(r.Profit), 0);
  const expenses = active.reduce((s, r) => s + num(r["Total Cost"]), 0);
  const margin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : "0";
  const uniqueVehicles = new Set(data.map((r) => r["Registration Number"])).size;
  const activeVehicles = new Set(
    active.map((r) => r["Registration Number"])
  ).size;
  const idleVehicles = uniqueVehicles - activeVehicles;

  const uniqueByReg = new Map<string, FleetRow>();
  data.forEach(r => { if (!uniqueByReg.has(r["Registration Number"])) uniqueByReg.set(r["Registration Number"], r); });
  const ages = [...uniqueByReg.values()].map(r => getVehicleAgeYears(r["Registration Date"])).filter(a => a > 0);
  const avgAge = ages.length ? (ages.reduce((s, a) => s + a, 0) / ages.length).toFixed(1) : "—";

  const cards = [
    { label: "Total Revenue", value: cr(revenue), sub: `${activeVehicles} active vehicles` },
    { label: "Net Profit", value: cr(profit), sub: `${margin}% overall margin` },
    { label: "Total Expenses", value: cr(expenses), sub: "fuel + repair + chauffeur + EMI" },
    { label: "Fleet Size", value: String(uniqueVehicles), sub: `${activeVehicles} active · ${idleVehicles} idle` },
    { label: "Avg Fleet Age", value: `${avgAge} yrs`, sub: `${ages.length} vehicles with reg. date` },
  ];

  function downloadExcel() {
    import("xlsx").then(XLSX => {
      const rows = cards.map(c => ({ Metric: c.label, Value: c.value, Detail: c.sub }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KPIs");
      XLSX.writeFile(wb, "kpi-summary.xlsx");
    });
  }

  function downloadCSV() {
    const csv = ["Metric,Value,Detail", ...cards.map(c => `${c.label},"${c.value}","${c.sub}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "kpi-summary.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mb-5">
      <div className="flex justify-end gap-2 mb-2">
        <button
          onClick={downloadCSV}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
        >
          ↓ CSV
        </button>
        <button
          onClick={downloadExcel}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
        >
          ↓ Excel
        </button>
      </div>
      <div
        className="grid gap-3.5 kpi-grid-resp"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
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
    </div>
  );
}
