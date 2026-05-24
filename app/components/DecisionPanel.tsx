"use client";

import type { FleetRow } from "../lib/types";
import { num } from "../lib/dataUtils";

type Verdict = "keep" | "sell" | "watch";

type ScoredRow = FleetRow & {
  _prof: number;
  _rev: number;
  _repair: number;
  _margin: number;
  _kms: number;
  _emi: number;
  _score: number;
};

function VehicleCard({ r, verdict, avgProfit, avgMargin, avgRepair }: {
  r: ScoredRow; verdict: Verdict; avgProfit: number; avgMargin: number; avgRepair: number;
}) {
  const pColor = r._prof >= 0 ? "#059669" : "#dc2626";
  const mPct = (r._margin * 100).toFixed(1);

  const vs =
    verdict === "keep"
      ? { bg: "rgba(5,150,105,0.1)", color: "#059669", border: "1px solid rgba(5,150,105,0.3)" }
      : verdict === "sell"
      ? { bg: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }
      : { bg: "rgba(217,119,6,0.1)", color: "#d97706", border: "1px solid rgba(217,119,6,0.3)" };

  const vl = verdict === "keep" ? "Keep" : verdict === "sell" ? "Sell" : "Watch";

  const reasons: string[] = [];
  if (verdict === "keep") {
    if (r._prof > avgProfit * 1.3) reasons.push("High profit");
    if (r._margin > avgMargin * 1.2) reasons.push("Above-avg margin");
    if (r._repair < avgRepair * 0.7) reasons.push("Low repair cost");
    if (r._kms > 3000) reasons.push("High utilisation");
  } else if (verdict === "sell") {
    if (r._prof < 0) reasons.push("Loss-making");
    if (r._emi === 0) reasons.push("No EMI — can sell");
    if (r._repair > avgRepair * 2) reasons.push("Very high repair");
    if (r._kms < 500) reasons.push("Low utilisation");
  } else {
    if (r._margin < avgMargin * 0.65) reasons.push("Low margin");
    if (r._repair > avgRepair * 1.4) reasons.push("Elevated repair");
    if (r._kms < 1000) reasons.push("Low KMS — monitor");
  }

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-mono font-bold text-xs" style={{ color: "#0f1c2e" }}>{r["Registration Number"] || "—"}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: vs.bg, color: vs.color, border: vs.border }}>{vl}</span>
      </div>
      <div className="flex gap-1 flex-wrap mb-2">
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--accent-glow)", color: "var(--accent2)" }}>{r.Model || "—"}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ color: "var(--text3)", background: "var(--surface)", border: "1px solid var(--border)" }}>{r._kms} km</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-1.5">
        {[
          { val: `₹${(r._prof / 1e3).toFixed(0)}K`, color: pColor, label: "Profit" },
          { val: `${mPct}%`, color: parseFloat(mPct) >= 20 ? "#059669" : parseFloat(mPct) >= 0 ? "#2563eb" : "#dc2626", label: "Margin" },
          { val: `₹${(r._repair / 1e3).toFixed(0)}K`, color: r._repair > avgRepair * 1.5 ? "#dc2626" : "#059669", label: "Repair" },
        ].map(cell => (
          <div key={cell.label} className="text-center rounded-lg py-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-bold" style={{ color: cell.color }}>{cell.val}</div>
            <div className="text-xs" style={{ color: "var(--text3)", fontSize: "9px" }}>{cell.label}</div>
          </div>
        ))}
      </div>
      {reasons.length > 0 && (
        <div className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>
          {reasons.map(r => "· " + r).join("  ")}
        </div>
      )}
    </div>
  );
}

export default function DecisionPanel({ data }: { data: FleetRow[] }) {
  const active = data.filter(r => num(r["Total Revenue"]) > 0);
  if (!active.length) {
    return (
      <div className="rounded-2xl p-5 mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text3)" }}>No active vehicles to analyse.</p>
      </div>
    );
  }

  const avgProfit = active.reduce((s, r) => s + num(r["Profit"]), 0) / active.length;
  const avgMargin = active.reduce((s, r) => {
    const rev = num(r["Total Revenue"]);
    return s + (rev > 0 ? num(r["Profit"]) / rev : 0);
  }, 0) / active.length;
  const avgRepair = active.reduce((s, r) => s + num(r["Repair Cost"]), 0) / active.length;

  const scored: ScoredRow[] = active.map(r => {
    const prof = num(r["Profit"]), rev = num(r["Total Revenue"]), repair = num(r["Repair Cost"]);
    const emi = num(r.EMI);
    const kms = num(r["Total KMS"]);
    const margin = rev > 0 ? prof / rev : 0;
    const score =
      (prof / Math.max(avgProfit, 1)) * 40 +
      (margin / Math.max(avgMargin, 0.001)) * 30 -
      (repair / Math.max(avgRepair, 1)) * 15 -
      (kms < 500 ? 15 : 0);
    return { ...r, _prof: prof, _rev: rev, _repair: repair, _margin: margin, _kms: kms, _emi: emi, _score: score };
  });

  const byScore = [...scored].sort((a, b) => b._score - a._score);
  const top = byScore.slice(0, 8);
  const sellCandidates = scored.filter(r => r._prof < 0 && r._emi === 0)
    .sort((a, b) => a._score - b._score).slice(0, 8);
  const watch = scored.filter(r => r._margin > 0 && r._margin < avgMargin * 0.65 && r._repair > avgRepair * 1.4).slice(0, 8);

  const col = (
    badge: React.ReactNode,
    items: ScoredRow[],
    verdict: Verdict,
    emptyMsg?: string
  ) => (
    <div>
      <div className="mb-2.5">{badge}</div>
      <div className="flex flex-col gap-2">
        {items.length ? (
          items.map((r, i) => (
            <VehicleCard key={`${r["Registration Number"]}_${r.Month}_${r.Year}_${i}`} r={r} verdict={verdict}
              avgProfit={avgProfit} avgMargin={avgMargin} avgRepair={avgRepair} />
          ))
        ) : (
          <div className="rounded-xl p-3.5 text-xs" style={{ color: "var(--text3)", background: "var(--surface2)", border: "1px solid var(--border)" }}>
            {emptyMsg}
          </div>
        )}
      </div>
    </div>
  );

  const badge = (label: string, color: string, bgColor: string, borderColor: string) => (
    <span className="inline-block text-xs font-bold px-3 py-1 rounded-lg"
      style={{ color, background: bgColor, border: `1px solid ${borderColor}` }}>
      {label}
    </span>
  );

  return (
    <div className="rounded-2xl p-5 mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-base font-semibold" style={{ color: "var(--text)" }}>
            Vehicle Intelligence — Keep vs Sell Advisor
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            Data-driven signals to help decide which vehicles to retain or dispose
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(16,185,129,0.2)" }}>Keep</span>
          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}>Consider Selling</span>
          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(217,119,6,0.1)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" }}>Watch</span>
        </div>
      </div>

      <div className="grid gap-3.5 mt-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {col(badge(`Keep — Top ${top.length} Performers`, "#059669", "rgba(5,150,105,0.08)", "rgba(5,150,105,0.2)"), top, "keep")}
        {col(badge(`Consider Selling — Loss + No EMI (${sellCandidates.length})`, "#dc2626", "rgba(220,38,38,0.08)", "rgba(220,38,38,0.2)"), sellCandidates, "sell",
          "No sell candidates — all loss-making vehicles still have EMI")}
        {col(badge(`Watch — High Repair + Low Margin (${watch.length})`, "#d97706", "rgba(217,119,6,0.08)", "rgba(217,119,6,0.2)"),
          watch, "watch", "No vehicles flagged — fleet is healthy")}
      </div>
    </div>
  );
}