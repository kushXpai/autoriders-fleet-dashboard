// app/page.tsx
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import UserMenu from "./components/UserMenu";
import FileUpload from "./components/FileUpload";
import FilterBar from "./components/FilterBar";
import KpiGrid from "./components/KpiGrid";
import InsightStrip from "./components/InsightStrip";
import Charts from "./components/Charts";
import DecisionPanel from "./components/DecisionPanel";
import VehicleTable from "./components/VehicleTable";
import PnLTable from "./components/PnLTable";
import type { FleetRow } from "./lib/types";
import { num } from "./lib/dataUtils";
import { getStoredUser } from "./lib/auth";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

// April–December belong to the FY that starts that year.
// January–March belong to the FY that started the previous year.
function getFYStart(month: string, year: string): number {
  const y = parseInt(year, 10) || 0;
  const idx = MONTH_ORDER.indexOf(month); // 0=Apr … 8=Dec, 9=Jan … 11=Mar
  return idx <= 8 ? y : y - 1;
}

function fyLabel(fyStart: number): string {
  return `FY${fyStart}-${String(fyStart + 1).slice(2)}`;
}

export default function Home() {
  const [allData, setAllData] = useState<FleetRow[]>([]);
  const [filterBranch, setFilterBranch] = useState<string[]>([]);
  const [filterFY, setFilterFY] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState<string[]>([]); // "Month|Year"
  const [filterModel, setFilterModel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [addingMonth, setAddingMonth] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "fleet" | "revenue"
  >("fleet");

  useEffect(() => {
    const user = getStoredUser();
    const role = user?.role || "branch";
    const branch = user?.username || "";
    fetch(`/api/data?role=${role}&branch=${encodeURIComponent(branch)}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (data && data.length > 0) setAllData(data);
      })
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, []);

  // ── Derived filter options ────────────────────────────────────────────────

  const branches = useMemo(
    () => [...new Set(allData.map((r) => r.Branch).filter(Boolean))].sort(),
    [allData]
  );

  // Unique FY labels sorted ascending: ["FY2024-25", "FY2025-26", ...]
  const financialYears = useMemo(() => {
    const fySet = new Set<string>();
    allData.forEach((r) => {
      if (r.Month && r.Year) fySet.add(fyLabel(getFYStart(r.Month, r.Year)));
    });
    return [...fySet].sort();
  }, [allData]);

  // Unique "Month|Year" pairs sorted in FY order (Apr-25, May-25 … Mar-26, Apr-26 …)
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

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    return allData.filter((r) => {
      if (filterBranch.length > 0 && !filterBranch.includes(r.Branch))
        return false;

      // FY filter — check if the row's month/year belongs to any selected FY
      if (filterFY.length > 0) {
        const rowFY = fyLabel(getFYStart(r.Month, r.Year));
        if (!filterFY.includes(rowFY)) return false;
      }

      // Month filter — stored as "Month|Year"
      if (filterMonth.length > 0 && !filterMonth.includes(`${r.Month}|${r.Year}`))
        return false;

      if (filterModel && r.Model !== filterModel) return false;
      if (filterStatus === "active" && !(num(r["Total Revenue"]) > 0))
        return false;
      if (filterStatus === "idle" && num(r["Total Revenue"]) > 0) return false;

      return true;
    });
  }, [allData, filterBranch, filterFY, filterMonth, filterModel, filterStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFilterChange = (
    branch: string[],
    fy: string[],
    month: string[],
    model: string,
    status: string
  ) => {
    setFilterBranch(branch);
    setFilterFY(fy);
    setFilterMonth(month);
    setFilterModel(model);
    setFilterStatus(status);
  };

  const resetFilters = () => {
    setFilterBranch([]);
    setFilterFY([]);
    setFilterMonth([]);
    setFilterModel("");
    setFilterStatus("");
  };

  const handleDataLoaded = useCallback((data: FleetRow[]) => {
    setAllData(data);
    resetFilters();
  }, []);

  const handleAddMonth = useCallback(async (file: File) => {
    setAddingMonth(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        alert("Upload failed: " + (err.error || "Unknown error"));
        return;
      }
      const user = getStoredUser();
      const role = user?.role || "branch";
      const branch = user?.username || "";
      const dataRes = await fetch(`/api/data?role=${role}&branch=${encodeURIComponent(branch)}`);
      const { data } = await dataRes.json();
      if (data) {
        setAllData(data);
        resetFilters();
      }
    } catch (err) {
      alert("Error adding month: " + (err as Error).message);
    } finally {
      setAddingMonth(false);
    }
  }, []);

  const handleReUpload = useCallback(() => {
    setAllData([]);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center min-h-screen"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-sm font-medium" style={{ color: "var(--text3)" }}>
          Loading fleet data…
        </div>
      </div>
    );
  }

  if (!allData.length) {
    return <FileUpload onDataLoaded={handleDataLoaded} />;
  }

  const uniqueMonths = [...new Set(allData.map((r) => `${r.Month} ${r.Year}`))];

  return (
    <div
      className="flex flex-col flex-1 min-h-screen"
      style={{ background: "var(--bg)" }}
    >
      <header
        className="flex items-center justify-between px-8 sticky top-0 z-50"
        style={{
          height: 62,
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
            <img
              src="/autoriders.webp"
              alt="Autoriders Logo"
              className="w-28 object-contain"
            />
          </div>
          <div>
            <h1
              className="syne text-lg font-extrabold"
              style={{
                background: "linear-gradient(135deg, #0f1c2e, #3d5270)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.3px",
              }}
            >
              Autoriders Fleet
            </h1>
            <div className="text-xs" style={{ color: "var(--text3)" }}>
              Fleet Intelligence Dashboard
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label
            className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: addingMonth ? "var(--text3)" : "var(--accent2)",
              background: "var(--accent-glow)",
              border: "1px solid rgba(59,130,246,0.2)",
              pointerEvents: addingMonth ? "none" : "auto",
            }}
          >
            {addingMonth ? "Uploading…" : "+ Upload File"}
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
          <UserMenu />
        </div>
      </header>

      <main className="flex flex-1">
        {/* Sidebar */}
        <aside
          className="w-64 border-r flex-shrink-0"
          style={{
            background: "#fff",
            borderColor: "var(--border)",
          }}
        >
          <div className="p-4">
            <div
              className="text-xs uppercase font-semibold mb-4"
              style={{ color: "var(--text3)" }}
            >
              Intelligence Modules
            </div>

            <button
              onClick={() => setActiveSection("fleet")}
              className="w-full text-left px-4 py-3 rounded-xl mb-2 transition"
              style={{
                background:
                  activeSection === "fleet"
                    ? "var(--accent-glow)"
                    : "transparent",
                color:
                  activeSection === "fleet"
                    ? "var(--accent2)"
                    : "var(--text)",
              }}
            >
              🚛 Fleet Intelligence
            </button>

            <button
              onClick={() => setActiveSection("revenue")}
              className="w-full text-left px-4 py-3 rounded-xl transition"
              style={{
                background:
                  activeSection === "revenue"
                    ? "var(--accent-glow)"
                    : "transparent",
                color:
                  activeSection === "revenue"
                    ? "var(--accent2)"
                    : "var(--text)",
              }}
            >
              💰 Revenue Intelligence
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 px-8 py-6 pb-10 fade-in main-pad">
          {activeSection === "fleet" ? (
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
              <VehicleTable data={filteredData} />
            </>
          ) : (
            <div
              className="rounded-3xl p-12"
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                className="text-3xl font-bold mb-3"
                style={{ color: "var(--text)" }}
              >
                Revenue Intelligence
              </h2>

              <p style={{ color: "var(--text3)" }}>
                Revenue Intelligence module coming soon.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}