"use client";

import { useState, useMemo, useCallback } from "react";
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
import { num, getFinancialYear } from "./lib/dataUtils";

const MONTH_ORDER = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

export default function Home() {
  const [allData, setAllData] = useState<FleetRow[]>([]);
  const [filterBranch, setFilterBranch] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState<string[]>([]);
  const [filterFY, setFilterFY] = useState<string[]>([]);
  const [filterModel, setFilterModel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const branches = useMemo(() => [...new Set(allData.map(r => r.Branch).filter(Boolean))].sort(), [allData]);
  const months = useMemo(() => [...new Set(allData.map(r => r.Month).filter(Boolean))].sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)), [allData]);
  const financialYears = useMemo(() => [...new Set(allData.map(r => getFinancialYear(r.Month, r.Year)).filter(Boolean))].sort(), [allData]);
  const models = useMemo(() => [...new Set(allData.map(r => r.Model).filter(Boolean))].sort(), [allData]);

  const filteredData = useMemo(() => {
    return allData.filter(r => {
      if (filterBranch.length > 0 && !filterBranch.includes(r.Branch)) return false;
      if (filterMonth.length > 0 && !filterMonth.includes(r.Month)) return false;
      if (filterFY.length > 0 && !filterFY.includes(getFinancialYear(r.Month, r.Year))) return false;
      if (filterModel && r.Model !== filterModel) return false;
      if (filterStatus === "active" && !(num(r["Total Revenue"]) > 0)) return false;
      if (filterStatus === "idle" && num(r["Total Revenue"]) > 0) return false;
      return true;
    });
  }, [allData, filterBranch, filterMonth, filterFY, filterModel, filterStatus]);

  const handleFilterChange = (branch: string[], month: string[], fy: string[], model: string, status: string) => {
    setFilterBranch(branch);
    setFilterMonth(month);
    setFilterFY(fy);
    setFilterModel(model);
    setFilterStatus(status);
  };

  const handleDataLoaded = useCallback((data: FleetRow[]) => {
    setAllData(prev => {
      const newPeriods = new Set(data.map(r => `${r.Month}|||${r.Year}`));
      const kept = prev.filter(r => !newPeriods.has(`${r.Month}|||${r.Year}`));
      return [...kept, ...data];
    });
    setFilterBranch([]);
    setFilterMonth([]);
    setFilterFY([]);
    setFilterModel("");
    setFilterStatus("");
  }, []);

  const handleReUpload = useCallback(() => {
    setAllData([]);
  }, []);

  if (!allData.length) {
    return <FileUpload onDataLoaded={handleDataLoaded} />;
  }

  const uniqueMonths = [...new Set(allData.map(r => `${r.Month} ${r.Year}`))];

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
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
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              boxShadow: "0 0 16px rgba(59,130,246,0.4)",
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <path d="M2 15l4-8 4 3 3-6 5 11H2z" fill="white" opacity=".9" />
            </svg>
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
          <div
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{
              color: "var(--text2)",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
            }}
          >
            {allData.length} vehicles · {uniqueMonths.length} month{uniqueMonths.length > 1 ? "s" : ""}
          </div>
          <label
            className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: "var(--accent2)",
              background: "var(--accent-glow)",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            + Add Month
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const ext = file.name.split(".").pop()?.toLowerCase();
                if (ext === "xlsx" || ext === "xls") {
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    const XLSX = await import("xlsx");
                    const workbook = XLSX.read(ev.target?.result, { type: "array" });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json<FleetRow>(sheet, { defval: "" });
                    const data = rows.filter(r => r["Registration Number"] && String(r["Registration Number"]).trim());
                    handleDataLoaded(data);
                  };
                  reader.readAsArrayBuffer(file);
                } else {
                  import("papaparse").then(({ default: Papa }) => {
                    Papa.parse<FleetRow>(file, {
                      header: true,
                      skipEmptyLines: true,
                      complete(results) {
                        const data = results.data.filter(r => r["Registration Number"] && r["Registration Number"].trim());
                        handleDataLoaded(data);
                      },
                    });
                  });
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={handleReUpload}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              color: "var(--text2)",
              background: "var(--surface2)",
              border: "1px solid var(--border2)",
            }}
          >
            Clear All
          </button>
          <UserMenu />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-screen-2xl mx-auto w-full px-8 py-6 pb-10 fade-in main-pad">
        <FilterBar
          branches={branches}
          months={months}
          financialYears={financialYears}
          models={models}
          filterBranch={filterBranch}
          filterMonth={filterMonth}
          filterFY={filterFY}
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
      </main>
    </div>
  );
}
