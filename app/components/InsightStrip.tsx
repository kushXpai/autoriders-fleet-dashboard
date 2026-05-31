// app/components/InsightStrip.tsx
"use client";

import type { FleetRow } from "../lib/types";
import { getActivePct, getAvgRev, getTopBranch } from "../lib/dataUtils";

export default function InsightStrip({ data }: { data: FleetRow[] }) {
  const items = [
    { val: getActivePct(data), label: "Fleet utilisation rate" },
    { val: getAvgRev(data), label: "Avg revenue per vehicle per month" },
    { val: getTopBranch(data), label: "Top fleet by revenue" },
  ];

  return (
    <div
      className="grid gap-3.5 mb-3.5 insight-resp"
      style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl px-5 py-4 flex items-center gap-3.5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <div
              className="text-xl font-bold"
              style={{ color: "var(--text)", letterSpacing: "-0.5px" }}
            >
              {item.val}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
              {item.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
