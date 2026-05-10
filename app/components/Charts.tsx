"use client";

import { useEffect, useRef } from "react";
import type { FleetRow } from "../lib/types";
import { num, getVehicleAgeBucket, aggregateByVehicle } from "../lib/dataUtils";
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

function DownloadImageBtn({ containerRef, title }: { containerRef: React.RefObject<HTMLDivElement | null>; title: string }) {
  function handleDownload() {
    if (!containerRef.current) return;
    const canvas = containerRef.current.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    a.click();
  }

  return (
    <button
      onClick={handleDownload}
      className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
      style={{ color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border2)" }}
      title="Download as image"
    >
      ↓ PNG
    </button>
  );
}

function CardWrap({ title, sub, chip, height, children }: {
  title: string; sub?: string; chip?: React.ReactNode; height: number; children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</div>
          {sub && <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{sub}</div>}
        </div>
        <div className="flex items-center gap-2">
          {chip}
          <DownloadImageBtn containerRef={containerRef} title={title} />
        </div>
      </div>
      <div ref={containerRef} style={{ position: "relative", height }}>{children}</div>
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

/* ─── Revenue by Model ────────────────────────────── */
function RevenueByModelChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agg = aggregateByVehicle(data);
  const active = agg.filter(r => num(r["Total Revenue"]) > 0);
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

/* ─── Model Doughnut ────────────────────────────── */
function ModelChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniqueRegs = new Map<string, string>();
  data.forEach(r => {
    if (!uniqueRegs.has(r["Registration Number"])) uniqueRegs.set(r["Registration Number"], r.Model || "Unknown");
  });
  const byModel: Record<string, number> = {};
  uniqueRegs.forEach(model => { byModel[model] = (byModel[model] || 0) + 1; });
  const sorted = Object.entries(byModel).map(([m, count]) => [m, count] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 10);

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

/* ─── Cost Breakdown ─────────────────────────────── */
function CostChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fuel = data.reduce((s, r) => s + num(r["Fuel Cost"]), 0);
  const repair = data.reduce((s, r) => s + num(r["Repair Cost"]), 0);
  const chauffeur = data.reduce((s, r) => s + num(r["Chauffeur Cost"]), 0);
  const emi = data.reduce((s, r) => s + num(r.EMI), 0);

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

/* ─── Profit Margin by Model ─────────────────────── */
function MarginChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agg = aggregateByVehicle(data);
  const active = agg.filter(r => num(r["Total Revenue"]) > 0);
  const byModel: Record<string, { rev: number; prof: number }> = {};
  active.forEach(r => {
    const model = r.Model || "Unknown";
    if (!byModel[model]) byModel[model] = { rev: 0, prof: 0 };
    byModel[model].rev += num(r["Total Revenue"]);
    byModel[model].prof += num(r.Profit);
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

/* ─── Scatter ──────────────────────────────────── */
function ScatterChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agg = aggregateByVehicle(data);
  const active = agg.filter(r => num(r["Total Revenue"]) > 0).slice(0, 300);

  const config: ChartConfiguration = {
    type: "scatter",
    data: {
      datasets: [{
        label: "Vehicle",
        data: active.map(r => ({ x: +(num(r["Total Revenue"]) / 1e5).toFixed(1), y: +(num(r.Profit) / 1e5).toFixed(1) })),
        backgroundColor: active.map(r => num(r.Profit) >= 0 ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"),
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => "Rev: ₹" + (c.parsed as {x:number;y:number}).x + "L  Profit: ₹" + (c.parsed as {x:number;y:number}).y + "L" } } },
      scales: {
        x: { grid: { color: "rgba(200,211,230,0.8)" }, title: { display: true, text: "Revenue (₹ Lakhs)", font: { size: 10 } }, ticks: { font: { size: 10 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, title: { display: true, text: "Profit (₹ Lakhs)", font: { size: 10 } }, ticks: { font: { size: 10 } }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

/* ─── KMS Distribution ────────────────────────── */
function KmsChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agg = aggregateByVehicle(data);
  const buckets: Record<string, number> = { "<1000": 0, "1000–2000": 0, "2000–3000": 0, "3000–4000": 0, "4000–5000": 0, "5000+": 0 };
  agg.forEach(r => {
    const kms = num(r["Total KMS"]);
    if (kms < 1000) buckets["<1000"]++;
    else if (kms < 2000) buckets["1000–2000"]++;
    else if (kms < 3000) buckets["2000–3000"]++;
    else if (kms < 4000) buckets["3000–4000"]++;
    else if (kms < 5000) buckets["4000–5000"]++;
    else buckets["5000+"]++;
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

/* ─── Profit by Model ────────────────────────────── */
function ProfitByModelChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agg = aggregateByVehicle(data);
  const active = agg.filter(r => num(r["Total Revenue"]) > 0);
  const byModel: Record<string, number[]> = {};
  active.forEach(r => {
    if (!byModel[r.Model]) byModel[r.Model] = [];
    byModel[r.Model].push(num(r.Profit));
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

/* ─── Fleet Age Distribution ─────────────────────── */
function AgeDistributionChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const AGE_ORDER = ['<1 Year', '1-2 Years', '2-3 Years', '3-5 Years', '5+ Years'];
  const uniqueByReg = new Map<string, FleetRow>();
  data.forEach(r => { if (!uniqueByReg.has(r["Registration Number"])) uniqueByReg.set(r["Registration Number"], r); });

  const buckets: Record<string, number> = {};
  AGE_ORDER.forEach(b => { buckets[b] = 0; });
  [...uniqueByReg.values()].forEach(r => {
    const bucket = getVehicleAgeBucket(r["Registration Date"]);
    if (bucket !== 'Unknown' && buckets[bucket] !== undefined) buckets[bucket]++;
  });

  const labels = AGE_ORDER.filter(b => buckets[b] > 0);
  const values = labels.map(b => buckets[b]);

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Vehicles",
        data: values,
        backgroundColor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"],
        borderRadius: 5, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => " " + (c.parsed as { x: number; y: number }).y + " vehicles" } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 11 } }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

/* ─── Profitability by Vehicle Age ───────────────── */
function ProfitByAgeChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const AGE_ORDER = ['<1 Year', '1-2 Years', '2-3 Years', '3-5 Years', '5+ Years'];
  const agg = aggregateByVehicle(data);
  const active = agg.filter(r => num(r["Total Revenue"]) > 0);

  const byAge: Record<string, { profit: number; count: number }> = {};
  AGE_ORDER.forEach(b => { byAge[b] = { profit: 0, count: 0 }; });

  active.forEach(r => {
    const bucket = getVehicleAgeBucket(r["Registration Date"]);
    if (bucket !== 'Unknown' && byAge[bucket]) {
      byAge[bucket].profit += num(r.Profit);
      byAge[bucket].count++;
    }
  });

  const labels = AGE_ORDER.filter(b => byAge[b].count > 0);
  const values = labels.map(b => +(byAge[b].profit / byAge[b].count / 1e3).toFixed(1));

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Avg Profit",
        data: values,
        backgroundColor: values.map(v => v >= 0 ? "#10b981" : "#ef4444"),
        borderRadius: 5, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => " ₹" + (c.parsed as { x: number; y: number }).y + "K avg profit" } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 10 }, callback: v => "₹" + v + "K" }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

/* ─── Repair Cost by Age ─────────────────────────── */
function RepairByAgeChart({ data }: { data: FleetRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const AGE_ORDER = ['<1 Year', '1-2 Years', '2-3 Years', '3-5 Years', '5+ Years'];
  const agg = aggregateByVehicle(data);
  const active = agg.filter(r => num(r["Total Revenue"]) > 0);

  const byAge: Record<string, { repair: number; count: number }> = {};
  AGE_ORDER.forEach(b => { byAge[b] = { repair: 0, count: 0 }; });

  active.forEach(r => {
    const bucket = getVehicleAgeBucket(r["Registration Date"]);
    if (bucket !== 'Unknown' && byAge[bucket]) {
      byAge[bucket].repair += num(r["Repair Cost"]);
      byAge[bucket].count++;
    }
  });

  const labels = AGE_ORDER.filter(b => byAge[b].count > 0);
  const values = labels.map(b => +(byAge[b].repair / byAge[b].count / 1e3).toFixed(1));

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Avg Repair",
        data: values,
        backgroundColor: values.map((_, i) => COLORS[i % COLORS.length]),
        borderRadius: 5, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => " ₹" + (c.parsed as { x: number; y: number }).y + "K avg repair" } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
        y: { grid: { color: "rgba(200,211,230,0.8)" }, ticks: { font: { size: 10 }, callback: v => "₹" + v + "K" }, border: { display: false } },
      },
    },
  };

  useChart(canvasRef, config);
  return <canvas ref={canvasRef} />;
}

/* ─── Main export ──────────────────────────────── */
export default function Charts({ data }: { data: FleetRow[] }) {
  return (
    <>
      {/* Top row */}
      <div className="grid gap-3.5 mb-3.5 chart-top-resp" style={{ gridTemplateColumns: "2.2fr 1fr" }}>
        <CardWrap title="Revenue by Model" sub="Sorted by total revenue · vehicle count in brackets" chip={<Chip label="₹ Lakhs" />} height={340}>
          <RevenueByModelChart data={data} />
        </CardWrap>
        <CardWrap title="Fleet by Model" sub="Vehicle count per model" height={340}>
          <ModelChart data={data} />
        </CardWrap>
      </div>

      {/* Mid row */}
      <div className="grid gap-3.5 mb-3.5 chart-mid-resp" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <CardWrap title="Cost Breakdown" sub="By expense category" chip={<Chip label="₹ L" />} height={220}>
          <CostChart data={data} />
        </CardWrap>
        <CardWrap title="Profit Margin by Model" sub="Profit ÷ Revenue %" chip={<Chip label="%" green />} height={220}>
          <MarginChart data={data} />
        </CardWrap>
        <CardWrap title="Revenue vs Profit" sub="Per vehicle scatter" height={220}>
          <ScatterChart data={data} />
        </CardWrap>
      </div>

      {/* Bottom row */}
      <div className="grid gap-3.5 mb-3.5 chart-bot-resp" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <CardWrap title="KMS Distribution" sub="Vehicles grouped by total kilometers" height={200}>
          <KmsChart data={data} />
        </CardWrap>
        <CardWrap title="Avg Profit by Model" sub="Which models are most profitable?" chip={<Chip label="₹K avg" />} height={200}>
          <ProfitByModelChart data={data} />
        </CardWrap>
      </div>

      {/* Age-based row */}
      <div className="grid gap-3.5 mb-3.5 chart-mid-resp" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <CardWrap title="Fleet Age Distribution" sub="Vehicles by age group" height={220}>
          <AgeDistributionChart data={data} />
        </CardWrap>
        <CardWrap title="Avg Profit by Age" sub="How age affects profitability" chip={<Chip label="₹K avg" />} height={220}>
          <ProfitByAgeChart data={data} />
        </CardWrap>
        <CardWrap title="Avg Repair by Age" sub="Maintenance cost vs vehicle age" chip={<Chip label="₹K avg" />} height={220}>
          <RepairByAgeChart data={data} />
        </CardWrap>
      </div>
    </>
  );
}
