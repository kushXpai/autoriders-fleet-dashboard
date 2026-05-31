// app/components/VehicleTrend.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { FleetRow } from "../lib/types";
import { num } from "../lib/dataUtils";
import {
  Chart,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
  type ChartConfiguration,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

function monthSortKey(month: string, year: string): number {
  const y = parseInt(year, 10) || 0;
  const m = MONTH_ORDER.indexOf(month);
  return y * 100 + (m >= 0 ? m : 50);
}

interface MonthlyMetric {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  kms: number;
}

export default function VehicleTrend({ data }: { data: FleetRow[] }) {
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const vehicles = useMemo(() => {
    const regs = new Set<string>();
    data.forEach(r => { if (r["Registration Number"]) regs.add(r["Registration Number"]); });
    return [...regs].sort();
  }, [data]);

  const monthlyData = useMemo((): MonthlyMetric[] => {
    if (!selectedVehicle) return [];
    const rows = data.filter(r => r["Registration Number"] === selectedVehicle);
    const byMonth = new Map<string, FleetRow>();
    rows.forEach(r => {
      const key = `${r.Month}|${r.Year}`;
      byMonth.set(key, r);
    });

    return [...byMonth.entries()]
      .sort((a, b) => {
        const [am, ay] = a[0].split("|");
        const [bm, by] = b[0].split("|");
        return monthSortKey(am, ay) - monthSortKey(bm, by);
      })
      .map(([key, r]) => {
        const [month, year] = key.split("|");
        return {
          label: `${month.substring(0, 3)}-${year.slice(2)}`,
          revenue: num(r["Total Revenue"]),
          cost: num(r["Total Cost"]),
          profit: num(r.Profit),
          kms: num(r["Total KMS"]),
        };
      });
  }, [data, selectedVehicle]);

  const trend = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const first = monthlyData[0].profit;
    const last = monthlyData[monthlyData.length - 1].profit;
    if (first === 0 && last === 0) return null;
    if (last > first) return "improving";
    if (last < first) return "declining";
    return "stable";
  }, [monthlyData]);

  useEffect(() => {
    if (!canvasRef.current || monthlyData.length === 0) {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      return;
    }

    if (chartRef.current) chartRef.current.destroy();

    const config: ChartConfiguration = {
      type: "line",
      data: {
        labels: monthlyData.map(m => m.label),
        datasets: [
          {
            label: "Revenue",
            data: monthlyData.map(m => +(m.revenue / 1e3).toFixed(1)),
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,0.08)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#2563eb",
          },
          {
            label: "Profit",
            data: monthlyData.map(m => +(m.profit / 1e3).toFixed(1)),
            borderColor: "#059669",
            backgroundColor: "rgba(5,150,105,0.08)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#059669",
          },
          {
            label: "Cost",
            data: monthlyData.map(m => +(m.cost / 1e3).toFixed(1)),
            borderColor: "#dc2626",
            backgroundColor: "rgba(220,38,38,0.05)",
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#dc2626",
            borderDash: [4, 4],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { font: { size: 11 }, padding: 12, boxWidth: 10, boxHeight: 10, color: "#475569" },
          },
          tooltip: {
            backgroundColor: "#1e293b",
            borderColor: "#334155",
            borderWidth: 1,
            titleColor: "#f1f5f9",
            bodyColor: "#94a3b8",
            padding: 10,
            callbacks: { label: c => ` ${c.dataset.label}: ₹${c.parsed.y}K` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } }, border: { display: false } },
          y: { grid: { color: "rgba(200,211,230,0.6)" }, ticks: { font: { size: 11 }, callback: v => "₹" + v + "K" }, border: { display: false } },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [monthlyData]);

  if (vehicles.length === 0) return null;

  const selectedRow = data.find(r => r["Registration Number"] === selectedVehicle);

  return (
    <div className="rounded-2xl p-5 mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Vehicle Month-on-Month Trend
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            Track how a specific vehicle performs across months
          </div>
        </div>
        <div className="flex items-center gap-3">
          {trend && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={
                trend === "improving"
                  ? { background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(5,150,105,0.2)" }
                  : trend === "declining"
                  ? { background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)" }
                  : { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(217,119,6,0.2)" }
              }
            >
              {trend === "improving" ? "↑ Improving" : trend === "declining" ? "↓ Declining" : "→ Stable"}
            </span>
          )}
          <select
            className="fleet-select"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">Select vehicle...</option>
            {vehicles.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedVehicle ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <svg className="mx-auto mb-3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p className="text-sm" style={{ color: "var(--text3)" }}>
            Select a vehicle to view its month-on-month performance
          </p>
        </div>
      ) : monthlyData.length < 2 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text3)" }}>
            Only 1 month of data available for this vehicle. Upload more months to see trends.
          </p>
        </div>
      ) : (
        <>
          {selectedRow && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent2)" }}>
                {selectedRow.Model}
              </span>
              <span className="text-xs" style={{ color: "var(--text3)" }}>
                {selectedRow.Branch}
              </span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total Revenue", value: `₹${(monthlyData.reduce((s, m) => s + m.revenue, 0) / 1e3).toFixed(0)}K`, color: "var(--accent2)" },
              { label: "Total Profit", value: `₹${(monthlyData.reduce((s, m) => s + m.profit, 0) / 1e3).toFixed(0)}K`, color: "var(--green)" },
              { label: "Total KMS", value: monthlyData.reduce((s, m) => s + m.kms, 0).toLocaleString("en-IN"), color: "var(--text)" },
              { label: "Months", value: String(monthlyData.length), color: "var(--text)" },
            ].map(item => (
              <div key={item.label} className="rounded-lg p-3 text-center" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="text-sm font-bold" style={{ color: item.color }}>{item.value}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ position: "relative", height: 240 }}>
            <canvas ref={canvasRef} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Month", "Revenue", "Cost", "Profit", "KMS", "Change"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m, i) => {
                  const prev = i > 0 ? monthlyData[i - 1].profit : null;
                  const change = prev !== null && prev !== 0 ? ((m.profit - prev) / Math.abs(prev) * 100) : null;
                  return (
                    <tr key={m.label} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs font-medium" style={{ color: "var(--text)" }}>{m.label}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text2)" }}>₹{(m.revenue / 1e3).toFixed(1)}K</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text2)" }}>₹{(m.cost / 1e3).toFixed(1)}K</td>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: m.profit >= 0 ? "var(--green)" : "var(--red)" }}>
                        ₹{(m.profit / 1e3).toFixed(1)}K
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text2)" }}>{m.kms.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{
                        color: change === null ? "var(--text3)" : change >= 0 ? "var(--green)" : "var(--red)"
                      }}>
                        {change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
