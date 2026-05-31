// app/components/RevenueIntelligence.tsx
"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripRow {
  "Payment Status"?: string;
  "Booking Ref No"?: string;
  "Invoice No"?: string;
  "Corporate Name"?: string;
  "Source Branch"?: string;
  "Customer Name"?: string;
  "Group Code"?: string;
  "Booker Name"?: string;
  "Duty City"?: string;
  "Car Type"?: string;
  "Car Booked"?: string;
  "Car Sent"?: string;
  "Upgread"?: string; // note: typo in source data
  "Usage Type"?: string;
  "Modified Usage Type"?: string;
  "Invoice Month"?: string;
  "Driver Name"?: string;
  "Vehicle No."?: string;
  "Ownership Type"?: string; // SELF | SPOT | ALLOTTED
  "Vendor Name"?: string;
  "Revenue Kms"?: string;
  "Total Kms"?: string;
  "Extra Kms"?: string;
  "Extra Hrs"?: string;
  "Basic Rate"?: string;
  "Total"?: string;
  "Sub Total"?: string;
  "Cgst"?: string;
  "Sgst"?: string;
  "Igst"?: string;
  "Total Tax"?: string;
  "Parking Amt"?: string;
  "Toll"?: string;
  "Driver Allowance"?: string;
  "Night Allowance"?: string;
  "App Duty"?: string;
  [key: string]: string | undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v?: string) => parseFloat(v || "0") || 0;

function fmtCr(val: number) {
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)} L`;
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtShort(val: number) {
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`;
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)} L`;
  if (val >= 1e3) return `₹${(val / 1e3).toFixed(1)}K`;
  return `₹${val.toFixed(0)}`;
}

const OWNERSHIP_COLORS: Record<string, string> = {
  SELF: "#3b82f6",
  SPOT: "#f59e0b",
  ALLOTTED: "#10b981",
};

const OWNERSHIP_BG: Record<string, string> = {
  SELF: "rgba(59,130,246,0.1)",
  SPOT: "rgba(245,158,11,0.1)",
  ALLOTTED: "rgba(16,185,129,0.1)",
};

const STATUS_COLOR: Record<string, string> = {
  Success: "#10b981",
  NoAction: "#94a3b8",
  Pending: "#f59e0b",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "20px 24px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: 26, fontWeight: 800, color: accent || "var(--text)", letterSpacing: "-0.5px", lineHeight: 1.1 }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function OwnershipBadge({ type }: { type: string }) {
  const t = (type || "").toUpperCase();
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 6,
        background: OWNERSHIP_BG[t] || "rgba(100,116,139,0.1)",
        color: OWNERSHIP_COLORS[t] || "#64748b",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {t || "—"}
    </span>
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 5, borderRadius: 99, background: "var(--border)", flex: 1, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 99 }} />
    </div>
  );
}

// Donut chart (pure SVG)
function DonutChart({
  segments,
  size = 110,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;
  const r = 38;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const gap = circ - dash;
    const slice = { ...seg, dash, gap, offset };
    offset += dash;
    return slice;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={16}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset + circ / 4}
          style={{ transition: "stroke-dasharray 0.5s" }}
        />
      ))}
      <circle cx={cx} cy={cy} r={28} fill="white" />
    </svg>
  );
}

// Simple bar chart rows
function BarList({
  items,
  valueFormatter,
  colorFn,
}: {
  items: { label: string; value: number; sub?: string }[];
  valueFormatter: (v: number) => string;
  colorFn?: (i: number) => string;
}) {
  const max = Math.max(...items.map((x) => x.value), 1);
  const COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#14b8a6", "#f97316", "#0ea5e9", "#a855f7"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {item.sub && <span style={{ fontSize: 11, color: "var(--text3)" }}>{item.sub}</span>}
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                {valueFormatter(item.value)}
              </span>
            </div>
          </div>
          <MiniBar pct={(item.value / max) * 100} color={colorFn ? colorFn(i) : COLORS[i % COLORS.length]} />
        </div>
      ))}
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text)",
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "4px 8px",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  trips: TripRow[];
  loading: boolean;
  onUpload: (file: File) => void;
  uploading: boolean;
}

export default function RevenueIntelligence({ trips, loading, onUpload, uploading }: Props) {
  const [filterBranch, setFilterBranch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterOwnership, setFilterOwnership] = useState("");
  const [filterCorporate, setFilterCorporate] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [sortCol, setSortCol] = useState<"revenue" | "trips" | "avg">("revenue");
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 20;

  // ── Filter options ──────────────────────────────────────────────────────────

  const branches = useMemo(() => [...new Set(trips.map((r) => r["Source Branch"] || r["Duty City"] || "").filter(Boolean))].sort(), [trips]);
  const invoiceMonths = useMemo(() => [...new Set(trips.map((r) => r["Invoice Month"] || "").filter(Boolean))].sort(), [trips]);
  const corporates = useMemo(() => [...new Set(trips.map((r) => r["Corporate Name"] || "").filter(Boolean))].sort(), [trips]);

  // ── Filtered trips ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return trips.filter((r) => {
      if (filterBranch && (r["Source Branch"] || r["Duty City"]) !== filterBranch) return false;
      if (filterMonth && r["Invoice Month"] !== filterMonth) return false;
      if (filterOwnership && (r["Ownership Type"] || "").toUpperCase() !== filterOwnership) return false;
      if (filterCorporate && r["Corporate Name"] !== filterCorporate) return false;
      if (filterPayment && r["Payment Status"] !== filterPayment) return false;
      return true;
    });
  }, [trips, filterBranch, filterMonth, filterOwnership, filterCorporate, filterPayment]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalRevenue = filtered.reduce((s, r) => s + n(r["Total"]), 0);
    const totalTrips = filtered.length;
    const successTrips = filtered.filter((r) => r["Payment Status"] === "Success").length;
    const totalKms = filtered.reduce((s, r) => s + n(r["Total Kms"]), 0);
    const upgraded = filtered.filter((r) => (r["Upgread"] || "").toUpperCase() === "YES").length;
    const avgPerTrip = totalTrips ? totalRevenue / totalTrips : 0;
    const corporateCount = new Set(filtered.map((r) => r["Corporate Name"]).filter(Boolean)).size;
    return { totalRevenue, totalTrips, successTrips, totalKms, upgraded, avgPerTrip, corporateCount };
  }, [filtered]);

  // ── Ownership split ─────────────────────────────────────────────────────────

  const ownershipData = useMemo(() => {
    const map: Record<string, { trips: number; revenue: number }> = {};
    filtered.forEach((r) => {
      const k = (r["Ownership Type"] || "UNKNOWN").toUpperCase();
      if (!map[k]) map[k] = { trips: 0, revenue: 0 };
      map[k].trips++;
      map[k].revenue += n(r["Total"]);
    });
    return Object.entries(map)
      .map(([k, v]) => ({ label: k, ...v, color: OWNERSHIP_COLORS[k] || "#94a3b8" }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // ── Top corporates ──────────────────────────────────────────────────────────

  const topCorporates = useMemo(() => {
    const map: Record<string, { revenue: number; trips: number }> = {};
    filtered.forEach((r) => {
      const k = r["Corporate Name"] || "Unknown";
      if (!map[k]) map[k] = { revenue: 0, trips: 0 };
      map[k].revenue += n(r["Total"]);
      map[k].trips++;
    });
    return Object.entries(map)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips} trips` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  // ── Usage type breakdown ────────────────────────────────────────────────────

  const usageData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      const k = r["Modified Usage Type"] || r["Usage Type"] || "Unknown";
      map[k] = (map[k] || 0) + n(r["Total"]);
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // ── Car type breakdown ──────────────────────────────────────────────────────

  const carTypeData = useMemo(() => {
    const map: Record<string, { revenue: number; trips: number }> = {};
    filtered.forEach((r) => {
      const k = r["Car Sent"] || r["Car Booked"] || r["Car Type"] || "Unknown";
      if (!map[k]) map[k] = { revenue: 0, trips: 0 };
      map[k].revenue += n(r["Total"]);
      map[k].trips++;
    });
    return Object.entries(map)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips}` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // ── Source branch breakdown ─────────────────────────────────────────────────

  const branchData = useMemo(() => {
    const map: Record<string, { revenue: number; trips: number }> = {};
    filtered.forEach((r) => {
      const k = r["Source Branch"] || "Unknown";
      if (!map[k]) map[k] = { revenue: 0, trips: 0 };
      map[k].revenue += n(r["Total"]);
      map[k].trips++;
    });
    return Object.entries(map)
      .map(([label, v]) => ({ label, value: v.revenue, sub: `${v.trips} trips` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // ── Monthly trend ───────────────────────────────────────────────────────────

  const monthlyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      const k = r["Invoice Month"] || "Unknown";
      map[k] = (map[k] || 0) + n(r["Total"]);
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered]);

  // ── Upgrade analysis ────────────────────────────────────────────────────────

  const upgradeData = useMemo(() => {
    const yes = filtered.filter((r) => (r["Upgread"] || "").toUpperCase() === "YES");
    const no = filtered.filter((r) => (r["Upgread"] || "").toUpperCase() !== "YES");
    return [
      { label: "Upgraded", value: yes.length, revenue: yes.reduce((s, r) => s + n(r["Total"]), 0), color: "#10b981" },
      { label: "No Upgrade", value: no.length, revenue: no.reduce((s, r) => s + n(r["Total"]), 0), color: "#94a3b8" },
    ];
  }, [filtered]);

  // ── Trip table ──────────────────────────────────────────────────────────────

  const searchedTrips = useMemo(() => {
    if (!tableSearch) return filtered;
    const q = tableSearch.toLowerCase();
    return filtered.filter(
      (r) =>
        (r["Corporate Name"] || "").toLowerCase().includes(q) ||
        (r["Vehicle No."] || "").toLowerCase().includes(q) ||
        (r["Booking Ref No"] || "").toLowerCase().includes(q) ||
        (r["Customer Name"] || "").toLowerCase().includes(q) ||
        (r["Driver Name"] || "").toLowerCase().includes(q)
    );
  }, [filtered, tableSearch]);

  const pagedTrips = useMemo(() => {
    return searchedTrips.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);
  }, [searchedTrips, tablePage]);

  const totalTablePages = Math.ceil(searchedTrips.length / TABLE_PAGE_SIZE);

  // Reset page on search/filter change
  useEffect(() => setTablePage(0), [tableSearch, filterBranch, filterMonth, filterOwnership, filterCorporate, filterPayment]);

  // ── Empty / loading states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>Loading revenue data…</div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 380,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 24,
          gap: 16,
        }}
      >
        <div style={{ fontSize: 40 }}>📊</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", textAlign: "center", marginBottom: 6 }}>
            No Revenue Data Yet
          </div>
          <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", marginBottom: 20 }}>
            Upload your billing/trip export (Excel/CSV) to see revenue intelligence
          </div>
          <label
            style={{
              display: "inline-block",
              cursor: uploading ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 24px",
              borderRadius: 10,
              background: "var(--accent2)",
              color: "#fff",
              border: "none",
            }}
          >
            {uploading ? "Uploading…" : "📁 Upload Revenue File"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  const card = {
    background: "#fff",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "20px 22px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header + Upload ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.3px" }}>
            💰 Revenue Intelligence
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            {filtered.length.toLocaleString()} trips · {invoiceMonths.length} months
          </div>
        </div>
        <label
          style={{
            cursor: uploading ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 700,
            padding: "7px 16px",
            borderRadius: 9,
            background: "var(--accent-glow)",
            color: "var(--accent2)",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          {uploading ? "Uploading…" : "+ Upload Revenue File"}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* ── Filters ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "12px 18px",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          FILTERS
        </span>
        <FilterPill label="Branch" options={branches} value={filterBranch} onChange={setFilterBranch} />
        <FilterPill label="Month" options={invoiceMonths} value={filterMonth} onChange={setFilterMonth} />
        <FilterPill label="Ownership" options={["SELF", "SPOT", "ALLOTTED"]} value={filterOwnership} onChange={setFilterOwnership} />
        <FilterPill label="Corporate" options={corporates} value={filterCorporate} onChange={setFilterCorporate} />
        <FilterPill label="Payment" options={["Success", "NoAction", "Pending"]} value={filterPayment} onChange={setFilterPayment} />
        {(filterBranch || filterMonth || filterOwnership || filterCorporate || filterPayment) && (
          <button
            onClick={() => { setFilterBranch(""); setFilterMonth(""); setFilterOwnership(""); setFilterCorporate(""); setFilterPayment(""); }}
            style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KpiCard label="Total Revenue" value={fmtCr(kpis.totalRevenue)} sub={`${kpis.totalTrips.toLocaleString()} trips`} accent="var(--accent2)" />
        <KpiCard label="Avg / Trip" value={fmtShort(kpis.avgPerTrip)} sub="per invoice" />
        <KpiCard label="Success Rate" value={`${kpis.totalTrips ? Math.round((kpis.successTrips / kpis.totalTrips) * 100) : 0}%`} sub={`${kpis.successTrips} paid`} accent="#10b981" />
        <KpiCard label="Total Kms" value={`${(kpis.totalKms / 1000).toFixed(1)}K`} sub="revenue kms" />
        <KpiCard label="Upgraded Trips" value={kpis.upgraded.toString()} sub={`${kpis.totalTrips ? Math.round((kpis.upgraded / kpis.totalTrips) * 100) : 0}% of trips`} accent="#f59e0b" />
        <KpiCard label="Corporates" value={kpis.corporateCount.toString()} sub="unique clients" />
      </div>

      {/* ── Row 2: Ownership split + Top corporates ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 14 }}>

        {/* Ownership split */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            Ownership Type Split
            <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>by revenue</span>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <DonutChart
              segments={ownershipData.map((o) => ({ label: o.label, value: o.revenue, color: o.color }))}
              size={110}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {ownershipData.map((o) => {
                const total = ownershipData.reduce((s, x) => s + x.revenue, 0);
                const pct = total ? (o.revenue / total) * 100 : 0;
                return (
                  <div key={o.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{o.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>{o.trips} trips</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{fmtShort(o.revenue)}</span>
                        <span style={{ fontSize: 11, color: "var(--text3)", minWidth: 32, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <MiniBar pct={pct} color={o.color} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top corporates */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            Top Corporate Clients
            <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>by total billed</span>
          </div>
          <BarList items={topCorporates} valueFormatter={fmtShort} />
        </div>
      </div>

      {/* ── Row 3: Usage types + Car types ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            Usage Type Breakdown
            <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>by revenue</span>
          </div>
          <BarList items={usageData} valueFormatter={fmtShort} colorFn={(i) => ["#3b82f6","#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#14b8a6","#f97316"][i % 8]} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            Car Type Performance
            <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>revenue · trips</span>
          </div>
          <BarList
            items={carTypeData}
            valueFormatter={fmtShort}
            colorFn={(i) => ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#14b8a6","#f97316","#6366f1"][i % 8]}
          />
        </div>
      </div>

      {/* ── Row 4: Source branch + Monthly trend + Upgrades ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 0.8fr", gap: 14 }}>

        {/* Source branch */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
            Revenue by Source Branch
          </div>
          <BarList items={branchData} valueFormatter={fmtShort} colorFn={(i) => ["#6366f1","#3b82f6","#0ea5e9","#14b8a6","#10b981","#84cc16","#f59e0b","#f97316"][i % 8]} />
        </div>

        {/* Monthly trend */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            Monthly Revenue Trend
            <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>invoice month</span>
          </div>
          {monthlyTrend.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text3)" }}>No month data</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {monthlyTrend.map((m, i) => {
                const max = Math.max(...monthlyTrend.map((x) => x.value), 1);
                const prev = i > 0 ? monthlyTrend[i - 1].value : null;
                const delta = prev ? ((m.value - prev) / prev) * 100 : null;
                return (
                  <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--text3)", width: 72, flexShrink: 0 }}>{m.label}</span>
                    <div style={{ flex: 1, height: 18, borderRadius: 5, background: "var(--border)", overflow: "hidden", position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          height: "100%",
                          width: `${(m.value / max) * 100}%`,
                          background: "linear-gradient(90deg, #3b82f6, #6366f1)",
                          borderRadius: 5,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", width: 68, textAlign: "right", flexShrink: 0 }}>
                      {fmtShort(m.value)}
                    </span>
                    {delta !== null && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: delta >= 0 ? "#10b981" : "#ef4444",
                          width: 38,
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upgrade analysis */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Upgrade Analysis</div>
          <DonutChart
            segments={upgradeData.map((u) => ({ label: u.label, value: u.value, color: u.color }))}
            size={100}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {upgradeData.map((u) => (
              <div key={u.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: u.color, display: "inline-block" }} />
                    {u.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{u.value}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)", paddingLeft: 12 }}>{fmtShort(u.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Trip Detail Table ── */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Trip Detail</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{searchedTrips.length.toLocaleString()} trips</div>
          </div>
          <input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search corporate, vehicle, booking ref…"
            style={{
              fontSize: 12,
              padding: "7px 12px",
              border: "1px solid var(--border)",
              borderRadius: 9,
              outline: "none",
              width: 260,
              color: "var(--text)",
              background: "#fff",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Booking Ref", "Invoice Month", "Corporate", "Source Branch", "Car Sent", "Ownership", "Usage Type", "Upgrade", "Kms", "Total", "Payment"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 12px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedTrips.map((r, i) => {
                const payStatus = r["Payment Status"] || "";
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: i % 2 === 0 ? "#fff" : "#fafbfc",
                    }}
                  >
                    <td style={{ padding: "8px 12px", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {r["Booking Ref No"] || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text3)", whiteSpace: "nowrap" }}>
                      {r["Invoice Month"] || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r["Corporate Name"] || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text3)", whiteSpace: "nowrap" }}>
                      {r["Source Branch"] || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text)", whiteSpace: "nowrap" }}>
                      {r["Car Sent"] || r["Car Booked"] || "—"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <OwnershipBadge type={r["Ownership Type"] || ""} />
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r["Modified Usage Type"] || r["Usage Type"] || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      {(r["Upgread"] || "").toUpperCase() === "YES" ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: 5 }}>YES</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text3)", textAlign: "right" }}>
                      {n(r["Total Kms"]).toFixed(0)}
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text)", textAlign: "right", whiteSpace: "nowrap" }}>
                      {fmtShort(n(r["Total"]))}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: payStatus === "Success" ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.12)",
                          color: STATUS_COLOR[payStatus] || "#94a3b8",
                        }}
                      >
                        {payStatus || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {pagedTrips.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 32, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                    No trips match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalTablePages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderTop: "1px solid var(--border)", background: "#fafbfc" }}>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              Page {tablePage + 1} of {totalTablePages} · {searchedTrips.length} trips
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                disabled={tablePage === 0}
                style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: tablePage === 0 ? "not-allowed" : "pointer", color: tablePage === 0 ? "var(--text3)" : "var(--text)" }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setTablePage((p) => Math.min(totalTablePages - 1, p + 1))}
                disabled={tablePage >= totalTablePages - 1}
                style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "#fff", cursor: tablePage >= totalTablePages - 1 ? "not-allowed" : "pointer", color: tablePage >= totalTablePages - 1 ? "var(--text3)" : "var(--text)" }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}