// app/components/Charts.tsx
"use client";

import { useEffect, useRef, useMemo } from "react";
import type { FleetRow } from "../lib/types";
import { num } from "../lib/dataUtils";
import {
  Chart,
  BarController, BarElement,
  DoughnutController, ArcElement,
  ScatterController, PointElement,
  LineController, LineElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
  type ChartConfiguration,
} from "chart.js";

Chart.register(
  BarController, BarElement,
  DoughnutController, ArcElement,
  ScatterController, PointElement,
  LineController, LineElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler
);

Chart.defaults.color = "#3d5270";
Chart.defaults.borderColor = "#dde4ef";
Chart.defaults.font.family = "'Outfit', sans-serif";

const COLORS = [
  "#3b82f6","#10b981","#ef4444","#f59e0b","#8b5cf6",
  "#ec4899","#06b6d4","#84cc16","#f97316","#6366f1",
];

const TIP = {
  backgroundColor: "#1e293b",
  borderColor: "#334155",
  borderWidth: 1,
  titleColor: "#f1f5f9",
  bodyColor: "#94a3b8",
  padding: 10,
};

const MONTH_ORDER = [
  "April","May","June","July","August","September",
  "October","November","December","January","February","March",
];

function getFYStart(month: string, year: string): number {
  const y = parseInt(year, 10) || 0;
  return MONTH_ORDER.indexOf(month) <= 8 ? y : y - 1;
}

function useChart(canvasRef: React.RefObject<HTMLCanvasElement | null>, config: ChartConfiguration | null) {
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!canvasRef.current || !config) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, config);
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);
}

function CardWrap({ title, sub, chip, height, children }: {
  title: string; sub?: string; chip?: React.ReactNode; height: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</div>
          {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{sub}</div>}
        </div>
        {chip}
      </div>
      <div style={{ position: "relative", height }}>{children}</div>
    </div>
  );
}

function Chip({ label, green }: { label: string; green?: boolean }) {
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wider"
      style={green
        ? { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(16,185,129,0.2)" }
        : { background: "var(--accent-glow)", color: "var(--accent2)", border: "1px solid rgba(59,130,246,0.2)" }
      }>
      {label}
    </span>
  );
}

function RevenueByModelChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = data.filter(r => num(r["Total Revenue"]) > 0);
  const byModel: Record<string, { rev: number; vehicles: Set<string> }> = {};
  active.forEach(r => {
    const model = r.Model || "Unknown";
    if (!byModel[model]) byModel[model] = { rev: 0, vehicles: new Set() };
    byModel[model].rev += num(r["Total Revenue"]);
    byModel[model].vehicles.add(r["Registration Number"]);
  });
  const sorted = Object.entries(byModel).sort((a, b) => b[1].rev - a[1].rev).slice(0, 12);

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map(([m, v]) => `${m} (${v.vehicles.size})`),
      datasets: [{
        label: "Revenue",
        data: sorted.map(([, v]) => +(v.rev / 1e5).toFixed(1)),
        backgroundColor: sorted.map((_, i) => i === 0 ? "#3b82f6" : "rgba(59,130,246,0.4)"),
        borderRadius: 5, borderSkipped: false,
      }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => " ₹" + (c.parsed as {x:number;y:number}).x.toFixed(1) + " L" } } },
      scales: {
        x: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 11 }, callback: v => "₹" + v + "L" }, border: { display: false } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

// #9: Branch revenue bar chart
function BranchRevenueChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = data.filter(r => num(r["Total Revenue"]) > 0);
  const byBranch: Record<string, { rev: number; profit: number }> = {};
  active.forEach(r => {
    const b = r.Branch || "Unknown";
    if (!byBranch[b]) byBranch[b] = { rev: 0, profit: 0 };
    byBranch[b].rev += num(r["Total Revenue"]);
    byBranch[b].profit += num(r["Profit"]);
  });
  const sorted = Object.entries(byBranch).sort((a, b) => b[1].rev - a[1].rev).slice(0, 15);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map(([b]) => cap(b)),
      datasets: [
        {
          label: "Revenue",
          data: sorted.map(([, v]) => +(v.rev / 1e5).toFixed(1)),
          backgroundColor: "rgba(59,130,246,0.55)",
          borderRadius: 4, borderSkipped: false,
        },
        {
          label: "Profit",
          data: sorted.map(([, v]) => +(v.profit / 1e5).toFixed(1)),
          backgroundColor: sorted.map(([, v]) => v.profit >= 0 ? "rgba(16,185,129,0.65)" : "rgba(239,68,68,0.65)"),
          borderRadius: 4, borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { size: 11 }, padding: 10, boxWidth: 10, boxHeight: 10 } },
        tooltip: { ...TIP, callbacks: { label: c => ` ${c.dataset.label}: ₹${(c.parsed as {x:number;y:number}).y.toFixed(1)} L` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 35, minRotation: 20 }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 11 }, callback: v => "₹" + v + "L" }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

function ModelChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const byModel: Record<string, Set<string>> = {};
  data.forEach(r => {
    const model = r.Model || "Unknown";
    if (!byModel[model]) byModel[model] = new Set();
    byModel[model].add(r["Registration Number"]);
  });
  const sorted = Object.entries(byModel).map(([m, s]) => [m, s.size] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: ChartConfiguration = {
    type: "doughnut",
    data: {
      labels: sorted.map(([m]) => m),
      datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: COLORS, borderWidth: 2, borderColor: "#ffffff", hoverOffset: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: "64%",
      plugins: {
        legend: { position: "right", labels: { font: { size: 11 }, padding: 10, boxWidth: 10, boxHeight: 10, color: "#3d5270" } },
        tooltip: { ...TIP, callbacks: { label: (c: any) => " " + c.label + ": " + c.parsed + " vehicles" } },
      },
    } as any,
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

function CostChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = data.filter(r => num(r["Total Revenue"]) > 0);
  const fuel = active.reduce((s, r) => s + num(r["Fuel Cost"]), 0);
  const repair = active.reduce((s, r) => s + num(r["Repair Cost"]), 0);
  const chauffeur = active.reduce((s, r) => s + num(r["Chauffeur Cost"]), 0);
  const emi = active.reduce((s, r) => s + num(r.EMI), 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: ChartConfiguration = {
    type: "doughnut",
    data: {
      labels: ["Fuel", "Chauffeur", "EMI", "Repair"],
      datasets: [{ data: [fuel, chauffeur, emi, repair].map(v => +(v / 1e5).toFixed(1)), backgroundColor: ["#3b82f6","#10b981","#f59e0b","#ef4444"], borderWidth: 2, borderColor: "#ffffff" }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 }, padding: 8, boxWidth: 10, boxHeight: 10, color: "#3d5270" } },
        tooltip: { ...TIP, callbacks: { label: (c: any) => " " + c.label + ": ₹" + c.parsed + " L" } },
      },
    } as any,
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

function MarginChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = data.filter(r => num(r["Total Revenue"]) > 0);
  const byModel: Record<string, { rev: number; prof: number }> = {};
  active.forEach(r => {
    const model = r.Model || "Unknown";
    if (!byModel[model]) byModel[model] = { rev: 0, prof: 0 };
    byModel[model].rev += num(r["Total Revenue"]);
    byModel[model].prof += num(r["Profit"]);
  });
  const sorted = Object.entries(byModel)
    .map(([b, v]) => [b, v.rev > 0 ? +(v.prof / v.rev * 100).toFixed(1) : 0] as [string, number])
    .sort((a, b) => b[1] - a[1]).slice(0, 8);

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map(([b]) => b),
      datasets: [{
        label: "Margin %",
        data: sorted.map(([, v]) => v),
        backgroundColor: sorted.map(([, v]) => v >= 30 ? "#10b981" : v >= 15 ? "#f59e0b" : "#ef4444"),
        borderRadius: 5, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => " " + (c.parsed as {x:number;y:number}).y + "%" } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 35, minRotation: 20, autoSkip: false }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 11 }, callback: v => v + "%" }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

// #11: Scatter chart with registration number in tooltip
function ScatterChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = data.filter(r => num(r["Total Revenue"]) > 0).slice(0, 300);

  // embed reg number as a custom property on each data point
  const points = active.map(r => ({
    x: +(num(r["Total Revenue"]) / 1e5).toFixed(1),
    y: +(num(r["Profit"]) / 1e5).toFixed(1),
    reg: r["Registration Number"] || "—",
    model: r.Model || "—",
  }));

  const config: ChartConfiguration = {
    type: "scatter",
    data: {
      datasets: [{
        label: "Vehicle",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: points as any,
        backgroundColor: active.map(r => num(r["Profit"]) >= 0 ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"),
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TIP,
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (c: any) => {
              const raw = c.raw as { x: number; y: number; reg: string; model: string };
              return [
                ` ${raw.reg} (${raw.model})`,
                ` Rev: ₹${raw.x}L  Profit: ₹${raw.y}L`,
              ];
            },
          },
        },
      },
      scales: {
        x: { grid: { color: "rgba(200,211,230,0.8)" }, title: { display: true, text: "Revenue (₹ Lakhs)", font: { size: 10 } }, ticks: { font: { size: 10 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, title: { display: true, text: "Profit (₹ Lakhs)", font: { size: 10 } }, ticks: { font: { size: 10 } }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

function KmsChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buckets: Record<string, number> = { "<1000": 0, "1–2K": 0, "2–3K": 0, "3–4K": 0, "4–5K": 0, "5K+": 0 };
  data.forEach(r => {
    const kms = num(r["Total KMS"]);
    if (kms < 1000) buckets["<1000"]++;
    else if (kms < 2000) buckets["1–2K"]++;
    else if (kms < 3000) buckets["2–3K"]++;
    else if (kms < 4000) buckets["3–4K"]++;
    else if (kms < 5000) buckets["4–5K"]++;
    else buckets["5K+"]++;
  });

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: Object.keys(buckets),
      datasets: [{ label: "Vehicles", data: Object.values(buckets), backgroundColor: ["#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#f59e0b","#ef4444"], borderRadius: 5, borderSkipped: false }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => " " + (c.parsed as {x:number;y:number}).y + " vehicles" } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 11 } }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

function ProfitByModelChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = data.filter(r => num(r["Total Revenue"]) > 0);
  const byModel: Record<string, number[]> = {};
  active.forEach(r => {
    if (!byModel[r.Model]) byModel[r.Model] = [];
    byModel[r.Model].push(num(r["Profit"]));
  });
  const sorted = Object.entries(byModel)
    .map(([m, profits]) => [m, profits.reduce((a, b) => a + b, 0) / profits.length] as [string, number])
    .sort((a, b) => b[1] - a[1]).slice(0, 8);

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map(([m]) => m),
      datasets: [{
        label: "Avg Profit",
        data: sorted.map(([, v]) => +(v / 1e3).toFixed(1)),
        backgroundColor: sorted.map(([, v]) => v >= 0 ? "#10b981" : "#ef4444"),
        borderRadius: 5, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => " ₹" + (c.parsed as {x:number;y:number}).y + "K avg profit" } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 10 }, callback: v => "₹" + v + "K" }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

// #10: Monthly revenue + profit trend line chart
function MonthlyTrendChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const monthlyData = useMemo(() => {
    const byMonth = new Map<string, { revenue: number; profit: number; cost: number }>();
    data.forEach(r => {
      if (!r.Month || !r.Year) return;
      const key = `${r.Month}|${r.Year}`;
      const e = byMonth.get(key) || { revenue: 0, profit: 0, cost: 0 };
      e.revenue += num(r["Total Revenue"]);
      e.profit += num(r["Profit"]);
      e.cost += num(r["Total Cost"]);
      byMonth.set(key, e);
    });
    return [...byMonth.entries()]
      .sort((a, b) => {
        const [am, ay] = a[0].split("|"), [bm, by] = b[0].split("|");
        const afy = getFYStart(am, ay), bfy = getFYStart(bm, by);
        if (afy !== bfy) return afy - bfy;
        return MONTH_ORDER.indexOf(am) - MONTH_ORDER.indexOf(bm);
      })
      .map(([key, v]) => {
        const [month, year] = key.split("|");
        return { label: `${month.substring(0, 3)}-${year.slice(2)}`, ...v };
      });
  }, [data]);

  const config: ChartConfiguration | null = monthlyData.length < 2 ? null : {
    type: "line",
    data: {
      labels: monthlyData.map(m => m.label),
      datasets: [
        {
          label: "Revenue",
          data: monthlyData.map(m => +(m.revenue / 1e5).toFixed(2)),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.07)",
          fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: "#3b82f6",
        },
        {
          label: "Profit",
          data: monthlyData.map(m => +(m.profit / 1e5).toFixed(2)),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.07)",
          fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: "#10b981",
        },
        {
          label: "Cost",
          data: monthlyData.map(m => +(m.cost / 1e5).toFixed(2)),
          borderColor: "#ef4444",
          backgroundColor: "transparent",
          fill: false, tension: 0.35, pointRadius: 3, pointBackgroundColor: "#ef4444",
          borderDash: [5, 4],
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { size: 11 }, padding: 12, boxWidth: 10, boxHeight: 10 } },
        tooltip: { ...TIP, callbacks: { label: c => ` ${c.dataset.label}: ₹${(c.parsed as {x:number;y:number}).y.toFixed(2)} L` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.6)" }, ticks: { font: { size: 11 }, callback: v => "₹" + v + "L" }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  if (monthlyData.length < 2) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text3)", fontSize: 12 }}>
      Need at least 2 months of data to show trend
    </div>
  );
  return <canvas ref={canvasRef} />;
}

// #12: Active vs Idle vehicle utilisation trend per month
function UtilisationTrendChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const monthlyData = useMemo(() => {
    const byMonth = new Map<string, { active: Set<string>; idle: Set<string> }>();
    data.forEach(r => {
      if (!r.Month || !r.Year || !r["Registration Number"]) return;
      const key = `${r.Month}|${r.Year}`;
      if (!byMonth.has(key)) byMonth.set(key, { active: new Set(), idle: new Set() });
      const e = byMonth.get(key)!;
      if (num(r["Total Revenue"]) > 0) e.active.add(r["Registration Number"]);
      else e.idle.add(r["Registration Number"]);
    });
    return [...byMonth.entries()]
      .sort((a, b) => {
        const [am, ay] = a[0].split("|"), [bm, by] = b[0].split("|");
        const afy = getFYStart(am, ay), bfy = getFYStart(bm, by);
        if (afy !== bfy) return afy - bfy;
        return MONTH_ORDER.indexOf(am) - MONTH_ORDER.indexOf(bm);
      })
      .map(([key, v]) => {
        const [month, year] = key.split("|");
        return {
          label: `${month.substring(0, 3)}-${year.slice(2)}`,
          active: v.active.size,
          idle: v.idle.size,
        };
      });
  }, [data]);

  const config: ChartConfiguration | null = monthlyData.length < 1 ? null : {
    type: "bar",
    data: {
      labels: monthlyData.map(m => m.label),
      datasets: [
        {
          label: "Active",
          data: monthlyData.map(m => m.active),
          backgroundColor: "rgba(16,185,129,0.65)",
          borderRadius: 4, borderSkipped: false, stack: "util",
        },
        {
          label: "Idle",
          data: monthlyData.map(m => m.idle),
          backgroundColor: "rgba(239,68,68,0.45)",
          borderRadius: 0, borderSkipped: false, stack: "util",
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { size: 11 }, padding: 10, boxWidth: 10, boxHeight: 10 } },
        tooltip: {
          ...TIP,
          callbacks: {
            label: c => {
              const v = (c.parsed as {x:number;y:number}).y;
              const total = monthlyData[c.dataIndex].active + monthlyData[c.dataIndex].idle;
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
              return ` ${c.dataset.label}: ${v} vehicles (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false }, stacked: true },
        y: { grid: { color: "rgba(200,211,230,0.6)" }, ticks: { font: { size: 11 } }, border: { display: false }, stacked: true },
      },
    },
  };

  useChart(canvasRef, config);
  if (!config) return null;
  return <canvas ref={canvasRef} />;
}

export default function Charts({ data }: { data: FleetRow[] }) {
  return (
    <>
      {/* Row 1: Revenue by model + Fleet by model */}
      <div className="grid gap-3.5 mb-3.5 chart-top-resp" style={{ gridTemplateColumns: "2.2fr 1fr" }}>
        <CardWrap title="Revenue by Model" sub="Sorted by total revenue · vehicle count in brackets" chip={<Chip label="₹ Lakhs" />} height={340}>
          <RevenueByModelChart data={data} />
        </CardWrap>
        <CardWrap title="Fleet by Model" sub="Vehicle count per model" height={340}>
          <ModelChart data={data} />
        </CardWrap>
      </div>

      {/* #9 Row 2: Branch revenue comparison */}
      <div className="mb-3.5">
        <CardWrap title="Revenue & Profit by Branch" sub="All branches · revenue vs profit side by side" chip={<Chip label="₹ Lakhs" />} height={260}>
          <BranchRevenueChart data={data} />
        </CardWrap>
      </div>

      {/* #10 Row 3: Monthly trend */}
      <div className="mb-3.5">
        <CardWrap title="Monthly Revenue · Profit · Cost Trend" sub="All months in current filter" chip={<Chip label="₹ Lakhs" />} height={220}>
          <MonthlyTrendChart data={data} />
        </CardWrap>
      </div>

      {/* Row 4: Cost + Margin + Scatter (#11) */}
      <div className="grid gap-3.5 mb-3.5 chart-mid-resp" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <CardWrap title="Cost Breakdown" sub="By expense category" chip={<Chip label="₹ L" />} height={220}>
          <CostChart data={data} />
        </CardWrap>
        <CardWrap title="Profit Margin by Model" sub="Profit ÷ Revenue %" chip={<Chip label="%" green />} height={220}>
          <MarginChart data={data} />
        </CardWrap>
        <CardWrap title="Revenue vs Profit" sub="Per vehicle · hover for registration number" height={220}>
          <ScatterChart data={data} />
        </CardWrap>
      </div>

      {/* Row 5: KMS distribution + Avg profit by model + #12 Utilisation trend */}
      <div className="grid gap-3.5 mb-3.5 chart-bot-resp" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <CardWrap title="KMS Distribution" sub="Vehicles grouped by total kilometers" height={200}>
          <KmsChart data={data} />
        </CardWrap>
        <CardWrap title="Avg Profit by Model" sub="Which models are most profitable?" chip={<Chip label="₹K avg" />} height={200}>
          <ProfitByModelChart data={data} />
        </CardWrap>
        <CardWrap title="Fleet Utilisation by Month" sub="Active vs idle vehicle count" height={200}>
          <UtilisationTrendChart data={data} />
        </CardWrap>
      </div>
    </>
  );
}
