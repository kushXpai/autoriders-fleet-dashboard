// app/components/PnLTable.tsx
"use client";

import type { FleetRow, MonthData } from "../lib/types";
import { num } from "../lib/dataUtils";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

function getFYStart(month: string, year: string): number {
  const y = parseInt(year, 10);
  const idx = MONTH_ORDER.indexOf(month);
  return idx <= 8 ? y : y - 1;
}

function fmt(v: number): string {
  return (v / 1e5).toFixed(2);
}

function pctChange(curr: number, prev: number): string {
  if (prev === 0) return curr === 0 ? "—" : "+∞";
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  return (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
}

function pctColor(curr: number, prev: number, invert?: boolean): string {
  if (prev === 0) return "var(--text3)";
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  if (invert) return change > 0 ? "var(--red)" : change < 0 ? "var(--green)" : "var(--text3)";
  return change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "var(--text3)";
}

// #8: inline sparkline SVG
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span style={{ color: "var(--text3)", fontSize: 10 }}>—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 56, H = 18;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const first = values[0], last = values[values.length - 1];
  const stroke = last > first ? "#10b981" : last < first ? "#ef4444" : "#94a3b8";
  const lx = W, ly = H - ((last - min) / range) * (H - 2) - 1;
  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} fill={stroke} />
    </svg>
  );
}

interface Summary {
  year: string;
  month: string;
  cdRev: number;
  sdRev: number;
  strRev: number;
  totalRev: number;
  fuel: number;
  repair: number;
  chauffeur: number;
  emi: number;
  totalCost: number;
  profit: number;
}

function groupDataByMonth(data: FleetRow[]): MonthData[] {
  const groups: Record<string, FleetRow[]> = {};
  data.forEach((row) => {
    const key = `${row.Month || "Unknown"}|${row.Year || "Unknown"}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  return Object.entries(groups).map(([key, rows]) => {
    const [month, year] = key.split("|");
    return { month, year, data: rows };
  });
}

export default function PnLTable({ data }: { data: FleetRow[] }) {
  const allMonths = groupDataByMonth(data);
  const sorted = [...allMonths].sort((a, b) => {
    const aFY = getFYStart(a.month, a.year);
    const bFY = getFYStart(b.month, b.year);
    if (aFY !== bFY) return aFY - bFY;
    return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
  });

  if (!sorted.length) return null;

  const summaries: Summary[] = sorted.map(({ year, month, data: mData }) => ({
    year, month,
    cdRev: mData.reduce((s, r) => s + num(r["CD Revenue"]), 0),
    sdRev: mData.reduce((s, r) => s + num(r["SD Revenue"]), 0),
    strRev: mData.reduce((s, r) => s + num(r["STR Revenue"]), 0),
    totalRev: mData.reduce((s, r) => s + num(r["Total Revenue"]), 0),
    fuel: mData.reduce((s, r) => s + num(r["Fuel Cost"]), 0),
    repair: mData.reduce((s, r) => s + num(r["Repair Cost"]), 0),
    chauffeur: mData.reduce((s, r) => s + num(r["Chauffeur Cost"]), 0),
    emi: mData.reduce((s, r) => s + num(r.EMI), 0),
    totalCost: mData.reduce((s, r) => s + num(r["Total Cost"]), 0),
    profit: mData.reduce((s, r) => s + num(r["Profit"]), 0),
  }));

  const yearly = {
    cdRev: summaries.reduce((s, m) => s + m.cdRev, 0),
    sdRev: summaries.reduce((s, m) => s + m.sdRev, 0),
    strRev: summaries.reduce((s, m) => s + m.strRev, 0),
    totalRev: summaries.reduce((s, m) => s + m.totalRev, 0),
    fuel: summaries.reduce((s, m) => s + m.fuel, 0),
    repair: summaries.reduce((s, m) => s + m.repair, 0),
    chauffeur: summaries.reduce((s, m) => s + m.chauffeur, 0),
    emi: summaries.reduce((s, m) => s + m.emi, 0),
    totalCost: summaries.reduce((s, m) => s + m.totalCost, 0),
    profit: summaries.reduce((s, m) => s + m.profit, 0),
  };

  // #7: best (highest profit) and worst (lowest profit) month indices
  const bestIdx = summaries.reduce((bi, m, i) => m.profit > summaries[bi].profit ? i : bi, 0);
  const worstIdx = summaries.reduce((wi, m, i) => m.profit < summaries[wi].profit ? i : wi, 0);

  // colCount = month cols + Category + YEARLY + % + Trend
  const colCount = summaries.length + 4;

  const th: React.CSSProperties = {
    padding: "10px 16px", fontSize: "11px", fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text3)",
    background: "var(--surface2)", borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap", textAlign: "right",
  };
  const td: React.CSSProperties = {
    padding: "9px 16px", fontSize: "12px", color: "var(--text2)",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    textAlign: "right", fontVariantNumeric: "tabular-nums",
  };
  const tdB: React.CSSProperties = { ...td, fontWeight: 700, color: "var(--text)" };
  const label: React.CSSProperties = {
    ...td, textAlign: "left", fontWeight: 500, color: "var(--text)",
    paddingLeft: "20px", minWidth: "200px",
  };
  const section: React.CSSProperties = {
    padding: "8px 16px", fontSize: "11px", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent2)",
    background: "var(--accent-glow)", borderBottom: "1px solid var(--border)", textAlign: "left",
  };

  // #7: cell background for best/worst month column
  function cellBg(i: number) {
    if (summaries.length > 1 && i === bestIdx) return "rgba(16,185,129,0.07)";
    if (summaries.length > 1 && i === worstIdx) return "rgba(220,38,38,0.07)";
    return undefined;
  }

  const Row = ({
    name, values, yearlyVal, pct, isBold, bg,
  }: {
    name: string; values: number[]; yearlyVal: number; pct: string; isBold?: boolean; bg?: string;
  }) => (
    <tr style={{ background: bg }}>
      <td style={isBold ? { ...label, fontWeight: 700 } : label}>{name}</td>
      {values.map((v, i) => (
        <td key={i} style={{ ...(isBold ? tdB : td), background: cellBg(i) }}>{fmt(v)}</td>
      ))}
      <td style={{ ...tdB, color: isBold ? "var(--accent2)" : "var(--text)" }}>{fmt(yearlyVal)}</td>
      <td style={{ ...td, fontWeight: 600 }}>{pct}</td>
      {/* #8: sparkline */}
      <td style={{ ...td, textAlign: "left", paddingLeft: 8, paddingRight: 8 }}>
        <Sparkline values={values} />
      </td>
    </tr>
  );

  return (
    <>
      <div className="rounded-2xl overflow-hidden mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Monthly P&L Summary</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            All values in ₹ Lakhs
            {summaries.length > 1 && (
              <span>
                {" · "}
                <span style={{ color: "#10b981", fontWeight: 600 }}>
                  ↑ {summaries[bestIdx].month.substring(0, 3)}-{summaries[bestIdx].year.slice(2)} best
                </span>
                {" · "}
                <span style={{ color: "#ef4444", fontWeight: 600 }}>
                  ↓ {summaries[worstIdx].month.substring(0, 3)}-{summaries[worstIdx].year.slice(2)} worst
                </span>
              </span>
            )}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "200px", minWidth: "200px" }} />
              {summaries.map((_, i) => <col key={i} style={{ width: "110px", minWidth: "90px" }} />)}
              <col style={{ width: "110px", minWidth: "90px" }} />
              <col style={{ width: "70px", minWidth: "60px" }} />
              <col style={{ width: "72px", minWidth: "72px" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Category</th>
                {summaries.map((m, i) => (
                  <th key={m.month + m.year} style={{
                    ...th,
                    background: i === bestIdx && summaries.length > 1
                      ? "rgba(16,185,129,0.12)"
                      : i === worstIdx && summaries.length > 1
                      ? "rgba(220,38,38,0.09)"
                      : "var(--surface2)",
                    color: i === bestIdx && summaries.length > 1
                      ? "#059669"
                      : i === worstIdx && summaries.length > 1
                      ? "#dc2626"
                      : "var(--text3)",
                  }}>
                    {m.month.substring(0, 3)}-{m.year.slice(2)}
                    {summaries.length > 1 && i === bestIdx && <div style={{ fontSize: 8, marginTop: 1 }}>★ BEST</div>}
                    {summaries.length > 1 && i === worstIdx && <div style={{ fontSize: 8, marginTop: 1 }}>▼ WORST</div>}
                  </th>
                ))}
                <th style={{ ...th, color: "var(--text)" }}>TOTAL</th>
                <th style={th}>%</th>
                <th style={{ ...th, textAlign: "left", paddingLeft: 8 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={colCount} style={section}>Revenue</td></tr>
              <Row name="Chauffeur Drive Revenue" values={summaries.map(m => m.cdRev)} yearlyVal={yearly.cdRev}
                pct={yearly.totalRev > 0 ? (yearly.cdRev / yearly.totalRev * 100).toFixed(1) + "%" : "—"} />
              <Row name="Self Drive Revenue" values={summaries.map(m => m.sdRev)} yearlyVal={yearly.sdRev}
                pct={yearly.totalRev > 0 ? (yearly.sdRev / yearly.totalRev * 100).toFixed(1) + "%" : "—"} />
              <Row name="Short Term Revenue" values={summaries.map(m => m.strRev)} yearlyVal={yearly.strRev}
                pct={yearly.totalRev > 0 ? (yearly.strRev / yearly.totalRev * 100).toFixed(1) + "%" : "—"} />
              <Row name="Total Revenue" values={summaries.map(m => m.totalRev)} yearlyVal={yearly.totalRev}
                pct="100%" isBold bg="var(--surface2)" />

              <tr><td colSpan={colCount} style={section}>Expenses</td></tr>
              <Row name="Fuel" values={summaries.map(m => m.fuel)} yearlyVal={yearly.fuel}
                pct={yearly.totalCost > 0 ? (yearly.fuel / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="Repairs & Maintenance" values={summaries.map(m => m.repair)} yearlyVal={yearly.repair}
                pct={yearly.totalCost > 0 ? (yearly.repair / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="Chauffeur Cost" values={summaries.map(m => m.chauffeur)} yearlyVal={yearly.chauffeur}
                pct={yearly.totalCost > 0 ? (yearly.chauffeur / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="E.M.I." values={summaries.map(m => m.emi)} yearlyVal={yearly.emi}
                pct={yearly.totalCost > 0 ? (yearly.emi / yearly.totalCost * 100).toFixed(1) + "%" : "—"} />
              <Row name="Total Expenses" values={summaries.map(m => m.totalCost)} yearlyVal={yearly.totalCost}
                pct="100%" isBold bg="var(--surface2)" />

              <tr><td colSpan={colCount} style={section}>Profit</td></tr>
              <tr style={{ background: "var(--green-dim)" }}>
                <td style={{ ...label, fontWeight: 700 }}>Operating Profit</td>
                {summaries.map((m, i) => (
                  <td key={i} style={{ ...tdB, color: m.profit >= 0 ? "var(--green)" : "var(--red)", background: cellBg(i) }}>
                    {fmt(m.profit)}
                  </td>
                ))}
                <td style={{ ...tdB, color: yearly.profit >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(yearly.profit)}</td>
                <td style={{ ...td, fontWeight: 700, color: "var(--green)" }}>
                  {yearly.totalRev > 0 ? (yearly.profit / yearly.totalRev * 100).toFixed(1) + "%" : "—"}
                </td>
                <td style={{ ...td, textAlign: "left", paddingLeft: 8 }}>
                  <Sparkline values={summaries.map(m => m.profit)} />
                </td>
              </tr>
              <tr>
                <td style={label}>Profit Margin %</td>
                {summaries.map((m, i) => (
                  <td key={i} style={{ ...td, fontWeight: 600, background: cellBg(i),
                    color: m.totalRev > 0 && m.profit / m.totalRev >= 0.3 ? "var(--green)" : "var(--amber)" }}>
                    {m.totalRev > 0 ? (m.profit / m.totalRev * 100).toFixed(1) + "%" : "—"}
                  </td>
                ))}
                <td style={{ ...tdB, color: "var(--green)" }}>
                  {yearly.totalRev > 0 ? (yearly.profit / yearly.totalRev * 100).toFixed(1) + "%" : "—"}
                </td>
                <td style={td}>—</td>
                <td style={td} />
              </tr>

              {/* #6: YTD Cumulative Profit row */}
              {summaries.length > 1 && (() => {
                let running = 0;
                const cumValues = summaries.map(m => { running += m.profit; return running; });
                return (
                  <tr style={{ background: "var(--surface2)", borderTop: "2px solid var(--border)" }}>
                    <td style={{ ...label, color: "var(--accent2)", fontWeight: 700 }}>Cumulative Profit (YTD)</td>
                    {cumValues.map((v, i) => (
                      <td key={i} style={{ ...td, fontWeight: 700, background: cellBg(i),
                        color: v >= 0 ? "var(--green)" : "var(--red)" }}>
                        {fmt(v)}
                      </td>
                    ))}
                    <td style={{ ...tdB, color: yearly.profit >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(yearly.profit)}</td>
                    <td style={td}>—</td>
                    <td style={{ ...td, textAlign: "left", paddingLeft: 8 }}>
                      <Sparkline values={cumValues} />
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {summaries.length > 1 && (
        <div className="rounded-2xl overflow-hidden mb-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Month-on-Month % Change</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>Percentage change from previous month</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "200px", minWidth: "200px" }} />
                {summaries.slice(1).map((_, i) => <col key={i} style={{ width: "140px", minWidth: "110px" }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Category</th>
                  {summaries.slice(1).map((m, i) => (
                    <th key={i} style={th}>
                      {summaries[i].month.substring(0, 3)} &rarr; {m.month.substring(0, 3)}-{m.year.slice(2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={summaries.length} style={section}>Revenue</td></tr>
                <ChangeRow label="Chauffeur Drive Revenue" summaries={summaries} field="cdRev" />
                <ChangeRow label="Self Drive Revenue" summaries={summaries} field="sdRev" />
                <ChangeRow label="Short Term Revenue" summaries={summaries} field="strRev" />
                <ChangeRow label="Total Revenue" summaries={summaries} field="totalRev" bold />
                <tr><td colSpan={summaries.length} style={section}>Expenses</td></tr>
                <ChangeRow label="Fuel" summaries={summaries} field="fuel" invert />
                <ChangeRow label="Repairs & Maintenance" summaries={summaries} field="repair" invert />
                <ChangeRow label="Chauffeur Cost" summaries={summaries} field="chauffeur" invert />
                <ChangeRow label="E.M.I." summaries={summaries} field="emi" invert />
                <ChangeRow label="Total Expenses" summaries={summaries} field="totalCost" invert bold />
                <tr><td colSpan={summaries.length} style={section}>Profit</td></tr>
                <ChangeRow label="Operating Profit" summaries={summaries} field="profit" bold />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function ChangeRow({ label: name, summaries, field, invert, bold }: {
  label: string; summaries: Summary[]; field: keyof Summary; invert?: boolean; bold?: boolean;
}) {
  const td: React.CSSProperties = {
    padding: "9px 16px", fontSize: "12px", borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap", textAlign: "right", fontVariantNumeric: "tabular-nums",
    fontWeight: bold ? 700 : 500,
  };
  const labelSt: React.CSSProperties = {
    ...td, textAlign: "left", color: "var(--text)", paddingLeft: "20px", minWidth: "200px",
  };
  return (
    <tr>
      <td style={labelSt}>{name}</td>
      {summaries.slice(1).map((m, i) => {
        const curr = m[field] as number;
        const prev = summaries[i][field] as number;
        return (
          <td key={i} style={{ ...td, color: pctColor(curr, prev, invert) }}>
            {pctChange(curr, prev)}
          </td>
        );
      })}
    </tr>
  );
}
