// app/components/Charts.tsx
"use client";

import { useEffect, useRef, useMemo } from "react";
import type { FleetRow } from "../lib/types";
import { num } from "../lib/dataUtils";
import {
  Chart,
  BarController, BarElement,
  ScatterController, PointElement,
  LineController, LineElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
  type ChartConfiguration,
} from "chart.js";

Chart.register(
  BarController, BarElement,
  ScatterController, PointElement,
  LineController, LineElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler
);

Chart.defaults.color = "#4b5563";
Chart.defaults.borderColor = "#e5e7eb";
Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// One palette for every chart: blue is the primary series, slate is neutral/secondary,
// green/red/amber are reserved for good/bad/warning.
const BLUE = "#2c5f9e";
const BLUE_LIGHT = "#7ba3d1";
const SLATE = "#64748b";
const SLATE_SOFT = "#cbd5e1";
const GREEN = "#15803d";
const RED = "#b91c1c";
const AMBER = "#a16207";
const GRID = "#eef0f3";

const TIP = {
  backgroundColor: "#111827",
  titleColor: "#f9fafb",
  bodyColor: "#e5e7eb",
  padding: 10,
  cornerRadius: 6,
};

const LEGEND = {
  position: "top" as const,
  align: "end" as const,
  labels: { font: { size: 11 }, padding: 12, boxWidth: 10, boxHeight: 10, usePointStyle: true },
};

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

function getFYStart(month: string, year: string): number {
  const y = parseInt(year, 10) || 0;
  return MONTH_ORDER.indexOf(month) <= 8 ? y : y - 1;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lakh = (v: number) => +(v / 1e5).toFixed(2);

/** Creates the Chart.js instance for a memoised config and destroys it on change/unmount. */
function useChart(canvasRef: React.RefObject<HTMLCanvasElement | null>, config: ChartConfiguration | null) {
  useEffect(() => {
    if (!canvasRef.current || !config) return;
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
  }, [canvasRef, config]);
}

function CardWrap({ title, sub, chip, height, children }: {
  title: string; sub?: string; chip?: React.ReactNode; height: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg p-4 md:p-5 min-w-0" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</div>
          {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{sub}</div>}
        </div>
        {chip}
      </div>
      <div style={{ position: "relative", height }}>{children}</div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0"
      style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}
    >
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text3)", fontSize: 12 }}>
      {text}
    </div>
  );
}

type Pt = { x: number; y: number };
const py = (c: { parsed: unknown }) => (c.parsed as Pt).y;
const px = (c: { parsed: unknown }) => (c.parsed as Pt).x;

const monthKey = (r: FleetRow) => `${r.Month}|${r.Year}`;
function sortMonthKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    const [am, ay] = a.split("|"), [bm, by] = b.split("|");
    const afy = getFYStart(am, ay), bfy = getFYStart(bm, by);
    return afy !== bfy ? afy - bfy : MONTH_ORDER.indexOf(am) - MONTH_ORDER.indexOf(bm);
  });
}
const monthLabel = (key: string) => {
  const [m, y] = key.split("|");
  return `${m.substring(0, 3)}-${y.slice(2)}`;
};

/** Per-month totals, in fiscal-year order. */
function monthlyTotals(data: FleetRow[]) {
  const by = new Map<string, {
    revenue: number; profit: number; cost: number;
    fuel: number; chauffeur: number; emi: number; repair: number;
    active: Set<string>; idle: Set<string>;
  }>();
  data.forEach((r) => {
    if (!r.Month || !r.Year) return;
    const k = monthKey(r);
    if (!by.has(k)) {
      by.set(k, { revenue: 0, profit: 0, cost: 0, fuel: 0, chauffeur: 0, emi: 0, repair: 0, active: new Set(), idle: new Set() });
    }
    const e = by.get(k)!;
    e.revenue += num(r["Total Revenue"]);
    e.profit += num(r.Profit);
    e.cost += num(r["Total Cost"]);
    e.fuel += num(r["Fuel Cost"]);
    e.chauffeur += num(r["Chauffeur Cost"]);
    e.emi += num(r.EMI);
    e.repair += num(r["Repair Cost"]);
    const reg = r["Registration Number"];
    if (reg) (num(r["Total Revenue"]) > 0 ? e.active : e.idle).add(reg);
  });
  return sortMonthKeys([...by.keys()]).map((k) => ({ label: monthLabel(k), ...by.get(k)! }));
}

/** Per-vehicle revenue/profit across the filtered period (earning vehicles only). */
function vehicleTotals(data: FleetRow[]) {
  const by = new Map<string, { reg: string; model: string; rev: number; profit: number }>();
  data.forEach((r) => {
    const reg = r["Registration Number"];
    if (!reg) return;
    const e = by.get(reg) ?? { reg, model: r.Model || "—", rev: 0, profit: 0 };
    e.rev += num(r["Total Revenue"]);
    e.profit += num(r.Profit);
    by.set(reg, e);
  });
  return [...by.values()].filter((v) => v.rev > 0);
}

// ── 1. Monthly trend: revenue & cost as bars, profit as a line ───────────────
function MonthlyTrendChart({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const m = monthlyTotals(data);
    if (!m.length) return null;
    return {
      type: "bar",
      data: {
        labels: m.map((x) => x.label),
        datasets: [
          { type: "line", label: "Profit", data: m.map((x) => lakh(x.profit)), borderColor: GREEN, backgroundColor: GREEN, tension: 0.3, pointRadius: 3, borderWidth: 2, order: 0 },
          { type: "bar", label: "Revenue", data: m.map((x) => lakh(x.revenue)), backgroundColor: BLUE, borderRadius: 3, order: 1 },
          { type: "bar", label: "Cost", data: m.map((x) => lakh(x.cost)), backgroundColor: SLATE_SOFT, borderRadius: 3, order: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: LEGEND, tooltip: { ...TIP, callbacks: { label: (c) => ` ${c.dataset.label}: ₹${py(c).toFixed(2)} L` } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
          y: { grid: { color: GRID }, ticks: { font: { size: 11 }, callback: (v) => "₹" + v + "L" }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="No monthly data" />;
}

// ── 2. Branch comparison: horizontal grouped bars ────────────────────────────
function branchRows(data: FleetRow[]) {
  const by: Record<string, { rev: number; profit: number }> = {};
  data.forEach((r) => {
    if (num(r["Total Revenue"]) <= 0) return;
    const b = r.Branch || "Unknown";
    by[b] = by[b] ?? { rev: 0, profit: 0 };
    by[b].rev += num(r["Total Revenue"]);
    by[b].profit += num(r.Profit);
  });
  return Object.entries(by).sort((a, b) => b[1].rev - a[1].rev);
}

function BranchChart({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const rows = branchRows(data);
    if (!rows.length) return null;
    return {
      type: "bar",
      data: {
        labels: rows.map(([b]) => cap(b)),
        datasets: [
          { label: "Revenue", data: rows.map(([, v]) => lakh(v.rev)), backgroundColor: BLUE, borderRadius: 3 },
          { label: "Profit", data: rows.map(([, v]) => lakh(v.profit)), backgroundColor: rows.map(([, v]) => (v.profit >= 0 ? GREEN : RED)), borderRadius: 3 },
        ],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: LEGEND, tooltip: { ...TIP, callbacks: { label: (c) => ` ${c.dataset.label}: ₹${px(c).toFixed(2)} L` } } },
        scales: {
          x: { grid: { color: GRID }, ticks: { font: { size: 11 }, callback: (v) => "₹" + v + "L" }, border: { display: false } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="No branch data" />;
}

// ── 3. Revenue by model ──────────────────────────────────────────────────────
function RevenueByModelChart({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const by: Record<string, { rev: number; vehicles: Set<string> }> = {};
    data.forEach((r) => {
      if (num(r["Total Revenue"]) <= 0) return;
      const m = r.Model || "Unknown";
      by[m] = by[m] ?? { rev: 0, vehicles: new Set() };
      by[m].rev += num(r["Total Revenue"]);
      by[m].vehicles.add(r["Registration Number"]);
    });
    const rows = Object.entries(by).sort((a, b) => b[1].rev - a[1].rev).slice(0, 10);
    if (!rows.length) return null;
    return {
      type: "bar",
      data: {
        labels: rows.map(([m, v]) => `${m} (${v.vehicles.size})`),
        datasets: [{ label: "Revenue", data: rows.map(([, v]) => lakh(v.rev)), backgroundColor: BLUE, borderRadius: 3 }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: (c) => ` ₹${px(c).toFixed(2)} L` } } },
        scales: {
          x: { grid: { color: GRID }, ticks: { font: { size: 11 }, callback: (v) => "₹" + v + "L" }, border: { display: false } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="No revenue data" />;
}

// ── 4. Cost mix by month (all vehicles, so it reconciles with Total Expenses) ─
function CostMixChart({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const m = monthlyTotals(data);
    if (!m.length) return null;
    const other = m.map((x) => Math.max(0, x.cost - x.fuel - x.chauffeur - x.emi - x.repair));
    const series = [
      { label: "Chauffeur", color: BLUE, vals: m.map((x) => x.chauffeur) },
      { label: "EMI", color: SLATE, vals: m.map((x) => x.emi) },
      { label: "Fuel", color: BLUE_LIGHT, vals: m.map((x) => x.fuel) },
      { label: "Repair", color: AMBER, vals: m.map((x) => x.repair) },
      { label: "Other", color: SLATE_SOFT, vals: other },
    ].filter((s) => s.vals.some((v) => v > 0));
    return {
      type: "bar",
      data: {
        labels: m.map((x) => x.label),
        datasets: series.map((s) => ({ label: s.label, data: s.vals.map(lakh), backgroundColor: s.color })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: LEGEND, tooltip: { ...TIP, callbacks: { label: (c) => ` ${c.dataset.label}: ₹${py(c).toFixed(2)} L` } } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
          y: { stacked: true, grid: { color: GRID }, ticks: { font: { size: 11 }, callback: (v) => "₹" + v + "L" }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="No cost data" />;
}

// ── 5. Utilisation by month: vehicles earning vs idle ────────────────────────
function UtilisationChart({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const m = monthlyTotals(data);
    if (!m.length) return null;
    // A vehicle that earned in the month counts as active even if it also has an idle row
    const act = m.map((x) => x.active.size);
    const idl = m.map((x) => [...x.idle].filter((v) => !x.active.has(v)).length);
    return {
      type: "bar",
      data: {
        labels: m.map((x) => x.label),
        datasets: [
          { label: "Active", data: act, backgroundColor: BLUE },
          { label: "Idle", data: idl, backgroundColor: SLATE_SOFT },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: LEGEND,
          tooltip: {
            ...TIP,
            callbacks: {
              label: (c) => {
                const total = act[c.dataIndex] + idl[c.dataIndex];
                const v = py(c);
                return ` ${c.dataset.label}: ${v} vehicles (${total ? ((v / total) * 100).toFixed(0) : 0}%)`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
          y: { stacked: true, grid: { color: GRID }, ticks: { font: { size: 11 } }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="No utilisation data" />;
}

// ── 6. Margin by model, coloured against the 15% / 30% thresholds ────────────
function MarginChart({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const by: Record<string, { rev: number; prof: number }> = {};
    data.forEach((r) => {
      if (num(r["Total Revenue"]) <= 0) return;
      const m = r.Model || "Unknown";
      by[m] = by[m] ?? { rev: 0, prof: 0 };
      by[m].rev += num(r["Total Revenue"]);
      by[m].prof += num(r.Profit);
    });
    const rows = Object.entries(by)
      .map(([m, v]) => [m, +((v.prof / v.rev) * 100).toFixed(1)] as [string, number])
      .sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!rows.length) return null;
    return {
      type: "bar",
      data: {
        labels: rows.map(([m]) => m),
        datasets: [{ label: "Margin %", data: rows.map(([, v]) => v), backgroundColor: rows.map(([, v]) => (v >= 30 ? GREEN : v >= 15 ? AMBER : RED)), borderRadius: 3 }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: (c) => ` ${px(c)}% margin` } } },
        scales: {
          x: { grid: { color: GRID }, ticks: { font: { size: 11 }, callback: (v) => v + "%" }, border: { display: false } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="No margin data" />;
}

// ── 7. Revenue concentration (Pareto / Lorenz curve) ─────────────────────────
function concentration(data: FleetRow[]) {
  const revs = vehicleTotals(data).map((v) => v.rev).sort((a, b) => b - a);
  const total = revs.reduce((s, v) => s + v, 0);
  if (revs.length < 5 || total <= 0) return null;
  const shareOfTop = (pct: number) => {
    const k = Math.max(1, Math.round((revs.length * pct) / 100));
    return (revs.slice(0, k).reduce((s, v) => s + v, 0) / total) * 100;
  };
  return { shareOfTop };
}

function ConcentrationChart({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const c = concentration(data);
    if (!c) return null;
    const steps = Array.from({ length: 11 }, (_, i) => i * 10);
    return {
      type: "line",
      data: {
        labels: steps.map((s) => s + "%"),
        datasets: [
          { label: "Revenue share", data: steps.map((s) => (s === 0 ? 0 : +c.shareOfTop(s).toFixed(1))), borderColor: BLUE, backgroundColor: "rgba(44,95,158,0.10)", fill: true, tension: 0.25, pointRadius: 3, borderWidth: 2 },
          { label: "Even spread", data: steps, borderColor: SLATE_SOFT, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5, fill: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: LEGEND,
          tooltip: { ...TIP, callbacks: { title: (i) => `Top ${i[0].label} of vehicles`, label: (ctx) => ` ${ctx.dataset.label}: ${py(ctx)}% of revenue` } },
        },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: "Top vehicles by revenue", font: { size: 10 } }, ticks: { font: { size: 11 } }, border: { display: false } },
          y: { min: 0, max: 100, grid: { color: GRID }, ticks: { font: { size: 11 }, callback: (v) => v + "%" }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="Need at least 5 earning vehicles" />;
}

// ── 8. Every vehicle: revenue vs profit (outliers stand out) ─────────────────
function VehicleScatter({ data }: { data: FleetRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useMemo(() => {
    const v = vehicleTotals(data);
    if (!v.length) return null;
    const pts = v.map((x) => ({ x: lakh(x.rev), y: lakh(x.profit), reg: x.reg, model: x.model }));
    return {
      type: "scatter",
      data: {
        datasets: [{
          label: "Vehicle",
          data: pts as unknown as Pt[],
          backgroundColor: v.map((x) => (x.profit >= 0 ? "rgba(21,128,61,0.55)" : "rgba(185,28,28,0.65)")),
          pointRadius: 4, pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TIP,
            callbacks: {
              label: (c) => {
                const r = c.raw as { x: number; y: number; reg: string; model: string };
                return [` ${r.reg} (${r.model})`, ` Revenue ₹${r.x} L · Profit ₹${r.y} L`];
              },
            },
          },
        },
        scales: {
          x: { grid: { color: GRID }, title: { display: true, text: "Revenue (₹ Lakhs)", font: { size: 10 } }, ticks: { font: { size: 10 } }, border: { display: false } },
          y: { grid: { color: GRID }, title: { display: true, text: "Profit (₹ Lakhs)", font: { size: 10 } }, ticks: { font: { size: 10 } }, border: { display: false } },
        },
      },
    } as ChartConfiguration;
  }, [data]);
  useChart(ref, config);
  return config ? <canvas ref={ref} /> : <Empty text="No vehicle data" />;
}

export default function Charts({ data }: { data: FleetRow[] }) {
  const branchCount = useMemo(() => branchRows(data).length, [data]);
  const conc = useMemo(() => concentration(data), [data]);
  const vehicleCount = useMemo(() => vehicleTotals(data).length, [data]);
  const rankedHeight = Math.max(220, branchCount * 40 + 50);

  return (
    <div className="flex flex-col gap-3 mb-4">
      <CardWrap title="Monthly Revenue, Cost & Profit" sub="Bars: revenue and cost · Line: profit" chip={<Chip label="₹ Lakhs" />} height={280}>
        <MonthlyTrendChart data={data} />
      </CardWrap>

      <div className="grid gap-3 chart-mid-resp" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <CardWrap title="Revenue & Profit by Branch" sub="Ranked by revenue" chip={<Chip label="₹ Lakhs" />} height={rankedHeight}>
          <BranchChart data={data} />
        </CardWrap>
        <CardWrap title="Revenue by Model" sub="Top 10 · vehicle count in brackets" chip={<Chip label="₹ Lakhs" />} height={rankedHeight}>
          <RevenueByModelChart data={data} />
        </CardWrap>
      </div>

      <div className="grid gap-3 chart-mid-resp" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <CardWrap title="Cost Mix by Month" sub="All vehicles, including idle" chip={<Chip label="₹ Lakhs" />} height={260}>
          <CostMixChart data={data} />
        </CardWrap>
        <CardWrap title="Fleet Utilisation by Month" sub="Vehicles earning vs idle" height={260}>
          <UtilisationChart data={data} />
        </CardWrap>
      </div>

      <div className="grid gap-3 chart-mid-resp" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <CardWrap title="Profit Margin by Model" sub="Green ≥ 30% · amber ≥ 15% · red below" chip={<Chip label="%" />} height={260}>
          <MarginChart data={data} />
        </CardWrap>
        <CardWrap
          title="Revenue Concentration"
          sub={conc ? `Top 20% of vehicles earn ${conc.shareOfTop(20).toFixed(0)}% of revenue` : "How evenly revenue is spread"}
          height={260}
        >
          <ConcentrationChart data={data} />
        </CardWrap>
      </div>

      <CardWrap title="Vehicle Profitability" sub={`${vehicleCount} earning vehicles · each dot is one vehicle · hover for registration`} chip={<Chip label="₹ Lakhs" />} height={300}>
        <VehicleScatter data={data} />
      </CardWrap>
    </div>
  );
}
