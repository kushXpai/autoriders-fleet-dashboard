// app/page.tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "next/image";
import UserMenu from "./components/UserMenu";
import FileUpload from "./components/FileUpload";
import FilterBar from "./components/FilterBar";
import KpiGrid from "./components/KpiGrid";
import InsightStrip from "./components/InsightStrip";
import Charts from "./components/Charts";
import DecisionPanel from "./components/DecisionPanel";
import VehicleTable from "./components/VehicleTable";
import PnLTable from "./components/PnLTable";
import RevenueIntelligence from "./components/RevenueIntelligence";
import type { RevenueRow } from "./lib/types";
import type { FleetRow } from "./lib/types";
import { num } from "./lib/dataUtils";
import { getStoredUser } from "./lib/auth";
import { postFleetFiles, readJson, fetchAllFleetData } from "./lib/api";
import VehicleTrend from "./components/VehicleTrend";
import ManagementReport from "./components/ManagementReport";
import DeleteDataPanel from "./components/DeleteDataPanel";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

function getFYStart(month: string, year: string): number {
  const y = parseInt(year, 10) || 0;
  const idx = MONTH_ORDER.indexOf(month);
  return idx <= 8 ? y : y - 1;
}

function fyLabel(fyStart: number): string {
  return `FY${fyStart}-${String(fyStart + 1).slice(2)}`;
}

export default function Home() {
  // ── Fleet state ────────────────────────────────────────────────────────────
  const [allData, setAllData] = useState<FleetRow[]>([]);
  const [filterBranch, setFilterBranch] = useState<string[]>([]);
  const [filterFY, setFilterFY] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState<string[]>([]);
  const [filterModel, setFilterModel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [addingMonth, setAddingMonth] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  // ── Revenue state ──────────────────────────────────────────────────────────
  const [trips, setTrips] = useState<RevenueRow[]>([]);
  const [tripsUploading, setTripsUploading] = useState(false);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<"fleet" | "revenue" | "management">("fleet");

  // ── Role check ─────────────────────────────────────────────────────────────
  const storedUser = getStoredUser();
  const userRole = storedUser?.role;
  const isDeveloper = userRole === "developer";
  const canSeeManagement = isDeveloper || userRole === "admin" || userRole === "superadmin" || userRole === "manager";
  const canUpload = isDeveloper || userRole === "superadmin";

  // ── Load fleet data ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAllFleetData()
      .then((data) => {
        if (data.length > 0) setAllData(data);
      })
      .catch((err) => {
        console.error(err);
        setLoadError((err as Error).message);
      })
      .finally(() => setInitialLoading(false));
  }, []);

  // ── Load revenue data when section becomes active ──────────────────────────
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const tripsLoading = activeSection === "revenue" && isDeveloper && !tripsLoaded;
  useEffect(() => {
    if (activeSection !== "revenue" || !isDeveloper || tripsLoaded) return;
    fetch("/api/revenue")
      .then((r) => readJson<{ data?: RevenueRow[]; error?: string }>(r))
      .then(({ data }) => {
        if (data) setTrips(data);
      })
      .catch(console.error)
      .finally(() => setTripsLoaded(true));
  }, [activeSection, isDeveloper, tripsLoaded]);

  // ── Fleet filter options ───────────────────────────────────────────────────
  const branches = useMemo(
    () => [...new Set(allData.map((r) => r.Branch).filter(Boolean))].sort(),
    [allData]
  );

  const financialYears = useMemo(() => {
    const fySet = new Set<string>();
    allData.forEach((r) => {
      if (r.Month && r.Year) fySet.add(fyLabel(getFYStart(r.Month, r.Year)));
    });
    return [...fySet].sort();
  }, [allData]);

  const months = useMemo(() => {
    const pairs = new Set<string>();
    allData.forEach((r) => {
      if (r.Month && r.Year) pairs.add(`${r.Month}|${r.Year}`);
    });
    return [...pairs].sort((a, b) => {
      const [am, ay] = a.split("|");
      const [bm, by] = b.split("|");
      const aFY = getFYStart(am, ay);
      const bFY = getFYStart(bm, by);
      if (aFY !== bFY) return aFY - bFY;
      return MONTH_ORDER.indexOf(am) - MONTH_ORDER.indexOf(bm);
    });
  }, [allData]);

  const models = useMemo(
    () => [...new Set(allData.map((r) => r.Model).filter(Boolean))].sort(),
    [allData]
  );

  // ── Fleet filtered data ────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    return allData.filter((r) => {
      if (filterBranch.length > 0 && !filterBranch.includes(r.Branch)) return false;
      if (filterFY.length > 0) {
        const rowFY = fyLabel(getFYStart(r.Month, r.Year));
        if (!filterFY.includes(rowFY)) return false;
      }
      if (filterMonth.length > 0 && !filterMonth.includes(`${r.Month}|${r.Year}`)) return false;
      if (filterModel && r.Model !== filterModel) return false;
      if (filterStatus === "active" && !(num(r["Total Revenue"]) > 0)) return false;
      if (filterStatus === "idle" && num(r["Total Revenue"]) > 0) return false;
      return true;
    });
  }, [allData, filterBranch, filterFY, filterMonth, filterModel, filterStatus]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleFilterChange = (
    branch: string[], fy: string[], month: string[], model: string, status: string
  ) => {
    setFilterBranch(branch);
    setFilterFY(fy);
    setFilterMonth(month);
    setFilterModel(model);
    setFilterStatus(status);
  };

  const resetFilters = () => {
    setFilterBranch([]); setFilterFY([]); setFilterMonth([]); setFilterModel(""); setFilterStatus("");
  };

  const handleDataLoaded = useCallback((data: FleetRow[]) => {
    setAllData(data);
    resetFilters();
  }, []);


  const handleAddMonth = useCallback(async (file: File) => {
    setAddingMonth(true);
    try {
      const result = await postFleetFiles([file], true);
      setAllData(await fetchAllFleetData());
      resetFilters();
      if (result.errors?.length) {
        alert(`Uploaded ${result.inserted ?? 0} rows with warnings:\n\n` + result.errors.join("\n"));
      }
    } catch (err) {
      alert("Upload failed: " + (err as Error).message);
    } finally {
      setAddingMonth(false);
    }
  }, []);

  const handleDeleted = useCallback(async () => {
    try {
      setAllData(await fetchAllFleetData());
      resetFilters();
    } catch (err) {
      alert("Could not refresh data: " + (err as Error).message);
    }
  }, []);

  // Upload revenue trip file
  const handleRevenueUpload = useCallback(async (file: File) => {
    setTripsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/revenue", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await readJson<{ error?: string }>(res);
        alert("Revenue upload failed: " + (err.error || "Unknown error"));
        return;
      }
      // Refresh revenue data
      const dataRes = await fetch("/api/revenue");
      const { data } = await readJson<{ data?: RevenueRow[] }>(dataRes);
      if (data) setTrips(data);
    } catch (err) {
      alert("Revenue upload error: " + (err as Error).message);
    } finally {
      setTripsUploading(false);
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="text-sm font-medium" style={{ color: "var(--text3)" }}>Loading fleet data…</div>
      </div>
    );
  }

  if (!allData.length) {
    if (loadError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center min-h-screen gap-3 px-6 text-center" style={{ background: "var(--bg)" }}>
          <div className="text-sm font-semibold" style={{ color: "var(--red)" }}>Could not load fleet data</div>
          <div className="text-xs max-w-md" style={{ color: "var(--text3)" }}>{loadError}</div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-semibold px-4 py-2 rounded-lg"
            style={{ color: "var(--accent2)", background: "var(--accent-glow)", border: "1px solid rgba(59,130,246,0.2)" }}
          >
            Retry
          </button>
        </div>
      );
    }
    if (canUpload) return <FileUpload onDataLoaded={handleDataLoaded} />;
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="text-sm font-medium" style={{ color: "var(--text3)" }}>No fleet data available. Contact your administrator.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="flex items-center justify-between px-4 md:px-8 sticky top-0 z-50 gap-2"
        style={{
          height: 62,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2 md:gap-3.5 min-w-0">
          <button
            type="button"
            aria-label="Open menu"
            className="md:hidden flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ border: "1px solid var(--border2)", color: "var(--text2)" }}
            onClick={() => setNavOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="hidden sm:flex w-12 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
            <Image src="/autoriders.webp" alt="Autoriders Logo" width={112} height={84} priority className="w-28 h-auto object-contain" />
          </div>
          <div className="min-w-0">
            <h1
              className="syne text-base md:text-lg font-extrabold truncate"
              style={{
                background: "linear-gradient(135deg, #0f1c2e, #3d5270)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.3px",
              }}
            >
              Autoriders Fleet
            </h1>
            <div className="text-xs hidden sm:block" style={{ color: "var(--text3)" }}>Fleet Intelligence Dashboard</div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {/* Fleet upload — superadmin and developer only */}
          {activeSection === "fleet" && canUpload && (
            <label
              className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{
                color: addingMonth ? "var(--text3)" : "var(--accent2)",
                background: "var(--accent-glow)",
                border: "1px solid rgba(59,130,246,0.2)",
                pointerEvents: addingMonth ? "none" : "auto",
              }}
            >
              {addingMonth ? "Uploading…" : "+ Upload"}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                disabled={addingMonth}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAddMonth(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <UserMenu />
        </div>
      </header>

      <main className="flex flex-1 min-w-0">
        {/* Sidebar */}
        {navOpen && (
          <div className="md:hidden fixed inset-0 z-[60]" style={{ background: "rgba(15,23,42,0.45)" }} onClick={() => setNavOpen(false)} />
        )}
        <aside className={`side-nav ${navOpen ? "open" : ""} w-64 border-r flex-shrink-0`} style={{ background: "#fff", borderColor: "var(--border)" }}>
          <div className="p-4">
            <div className="text-xs uppercase font-semibold mb-4" style={{ color: "var(--text3)" }}>
              Intelligence Modules
            </div>

            <button
              onClick={() => { setActiveSection("fleet"); setNavOpen(false); }}
              className="w-full text-left px-4 py-3 rounded-xl mb-2 transition"
              style={{
                background: activeSection === "fleet" ? "var(--accent-glow)" : "transparent",
                color: activeSection === "fleet" ? "var(--accent2)" : "var(--text)",
              }}
            >
              🚛 Fleet Intelligence
            </button>

            {isDeveloper && (
            <button
              onClick={() => { setActiveSection("revenue"); setNavOpen(false); }}
              className="w-full text-left px-4 py-3 rounded-xl mb-2 transition"
              style={{
                background: activeSection === "revenue" ? "var(--accent-glow)" : "transparent",
                color: activeSection === "revenue" ? "var(--accent2)" : "var(--text)",
              }}
            >
              💰 Revenue Intelligence
            </button>
            )}

            {canSeeManagement && (
            <button
              onClick={() => { setActiveSection("management"); setNavOpen(false); }}
              className="w-full text-left px-4 py-3 rounded-xl transition"
              style={{
                background: activeSection === "management" ? "var(--accent-glow)" : "transparent",
                color: activeSection === "management" ? "var(--accent2)" : "var(--text)",
              }}
            >
              📋 Management Report
            </button>
            )}
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 px-4 md:px-8 py-6 pb-10 fade-in main-pad" style={{ minWidth: 0, overflow: "hidden" }}>
          {activeSection === "management" && canSeeManagement ? (
            <ManagementReport allData={allData} />
          ) : activeSection === "fleet" || !isDeveloper ? (
            <>
              <FilterBar
                branches={branches}
                financialYears={financialYears}
                months={months}
                models={models}
                filterBranch={filterBranch}
                filterFY={filterFY}
                filterMonth={filterMonth}
                filterModel={filterModel}
                filterStatus={filterStatus}
                totalCount={filteredData.length}
                onChange={handleFilterChange}
              />
              <KpiGrid data={filteredData} />
              <InsightStrip data={filteredData} />
              <PnLTable data={filteredData} />
              <Charts data={filteredData} />
              <DecisionPanel data={filteredData} />
              <VehicleTrend data={filteredData} />
              <VehicleTable data={filteredData} />
              {canUpload && (
                <DeleteDataPanel allData={allData} onDeleted={handleDeleted} />
              )}
            </>
          ) : (
            <RevenueIntelligence
              trips={trips}
              loading={tripsLoading}
              onUpload={handleRevenueUpload}
              uploading={tripsUploading}
            />
          )}
        </div>
      </main>
    </div>
  );
}