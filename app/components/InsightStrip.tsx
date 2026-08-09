// app/components/InsightStrip.tsx
"use client";

import { useMemo } from "react";
import type { FleetRow } from "../lib/types";
import { num, cr } from "../lib/dataUtils";

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InsightStrip({ data }: { data: FleetRow[] }) {
  const stats = useMemo(() => {
    const active = data.filter((r) => num(r["Total Revenue"]) > 0);
    const totalRevenue = active.reduce((s, r) => s + num(r["Total Revenue"]), 0);
    const totalCost = data.reduce((s, r) => s + num(r["Total Cost"]), 0);
    const repairCost = data.reduce((s, r) => s + num(r["Repair Cost"]), 0);

    const uniqueAll = new Set(data.map((r) => r["Registration Number"])).size;
    const uniqueActive = new Set(active.map((r) => r["Registration Number"])).size;
    const idleCount = uniqueAll - uniqueActive;
    const utilPct = uniqueAll > 0 ? (uniqueActive / uniqueAll) * 100 : 0;

    const uniqueMonths = new Set(active.map((r) => `${r.Month}|${r.Year}`)).size;
    const avgRevPerVehiclePerMonth =
      uniqueActive > 0 && uniqueMonths > 0 ? totalRevenue / uniqueActive / uniqueMonths : 0;

    // #4: branch revenues
    const byBranch: Record<string, number> = {};
    active.forEach((r) => {
      const b = r.Branch || "Unknown";
      byBranch[b] = (byBranch[b] || 0) + num(r["Total Revenue"]);
    });
    const branchEntries = Object.entries(byBranch).sort((a, b) => b[1] - a[1]);
    const topBranch = branchEntries[0] ?? null;
    const worstBranch = branchEntries.length > 1 ? branchEntries[branchEntries.length - 1] : null;

    const repairPct = totalCost > 0 ? (repairCost / totalCost) * 100 : 0;

    return { utilPct, idleCount, avgRevPerVehiclePerMonth, topBranch, worstBranch, repairPct };
  }, [data]);

  const tiles = [
    {
      val: stats.utilPct.toFixed(1) + "%",
      sub: `Fleet utilisation · ${stats.idleCount} idle`,
      color: stats.utilPct >= 80 ? "#10b981" : stats.utilPct >= 60 ? "#f59e0b" : "#ef4444",
    },
    {
      val: cr(stats.avgRevPerVehiclePerMonth),
      sub: "Avg revenue / vehicle / month",
      color: "var(--accent2)",
    },
    {
      // #4: top branch with revenue
      val: stats.topBranch ? cap(stats.topBranch[0]) : "—",
      sub: stats.topBranch ? `Top branch · ${cr(stats.topBranch[1])}` : "Top branch",
      color: "#10b981",
    },
    {
      // #5: worst branch
      val: stats.worstBranch ? cap(stats.worstBranch[0]) : "—",
      sub: stats.worstBranch ? `Lowest branch · ${cr(stats.worstBranch[1])}` : "Lowest branch",
      color: "#ef4444",
    },
    {
      // #5: repair cost pressure
      val: stats.repairPct.toFixed(1) + "%",
      sub: "Repair share of total cost",
      color: stats.repairPct > 20 ? "#ef4444" : stats.repairPct > 12 ? "#f59e0b" : "#10b981",
    },
  ];

  return (
    <div className="grid gap-3.5 mb-3.5 insight-resp" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
      {tiles.map((item) => (
        <div
          key={item.sub}
          className="rounded-2xl px-5 py-4 flex items-center gap-3.5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-xl font-bold" style={{ color: item.color, letterSpacing: "-0.5px" }}>
              {item.val}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
