# Autoriders Fleet Performance Dashboard

A client-side fleet intelligence dashboard for analyzing vehicle fleet performance — revenue, costs, profitability, and utilization — built with Next.js and React.

## Features

- **File Upload** — Import fleet data via CSV or Excel (.xlsx/.xls) with drag-and-drop support
- **Multi-Month Analysis** — Load multiple months of data and compare performance over time
- **Dynamic Filtering** — Filter by Branch, Month, Year, Fleet, Model, and vehicle status (active/idle)
- **KPI Overview** — Total Revenue, Net Profit, Expenses, Fleet Size, and Fleet count at a glance
- **P&L Summary** — Monthly profit & loss table with revenue breakdown (CD/SD/STR) and expense categories, plus month-on-month % change tracking
- **7 Interactive Charts** — Revenue by Model, Fleet by Model (doughnut), Cost Breakdown, Profit Margin, Revenue vs Profit (scatter), KMS Distribution, and Avg Profit by Model
- **Keep vs Sell Advisor** — Scores vehicles on profit, margin, repair cost, and utilization to recommend Keep, Sell, or Watch actions with reasoning
- **Vehicle Table** — Paginated, sortable, searchable table with CSV and Excel export
- **Responsive Design** — Adapts to desktop, tablet, and mobile screens

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19 |
| Styling | Tailwind CSS 4, CSS custom properties |
| Charts | Chart.js 4 |
| Data Parsing | PapaParse (CSV), xlsx (Excel) |
| Language | TypeScript (strict mode) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Usage

1. Open the app and upload a CSV or Excel file containing fleet data
2. Use the filter bar to narrow down by branch, month, year, fleet, model, or status
3. Review KPIs, P&L tables, charts, and the Keep/Sell advisor
4. Click **+ Add Month** in the header to load additional months for comparison
5. Export filtered data as CSV or Excel from the Vehicle Table

### Expected Data Columns

| Column | Description |
|--------|-------------|
| Branch | Operating branch |
| Month | Month name (e.g., "April") |
| Year | Year (e.g., "2025") |
| Registration No. | Vehicle registration number |
| Model | Vehicle model |
| FLEET | Fleet group number |
| Opening KMS / Closing KMS / Total KMS | Kilometer readings |
| CD- Kms / SD - Kms / STR Kms | KMS by service type |
| REVENUE KMS / NRK | Revenue and non-revenue kilometers |
| CD REVENUE / SD REVENUE / S.T.R. REVENUE | Revenue by service type |
| Total Revenue | Combined revenue |
| Fuel cost / Repair Cost / Chauff.cost / EMI | Expense categories |
| TOTAL COST | Combined expenses |
| PROFIT / Profit % | Profitability metrics |

## Project Structure

```
app/
├── page.tsx              # Main dashboard (state management, filters, layout)
├── layout.tsx            # Root layout with metadata
├── globals.css           # Design system (CSS variables, animations, responsive)
├── components/
│   ├── FileUpload.tsx    # Upload screen with CSV/Excel parsing
│   ├── FilterBar.tsx     # Multi-select and dropdown filters
│   ├── KpiGrid.tsx       # 5 KPI summary cards
│   ├── InsightStrip.tsx  # 3 quick insight tiles
│   ├── PnLTable.tsx      # Monthly P&L + MoM % change tables
│   ├── Charts.tsx        # 7 Chart.js visualizations
│   ├── DecisionPanel.tsx # Keep vs Sell vehicle advisor
│   ├── VehicleTable.tsx  # Paginated sortable table with export
│   └── UserMenu.tsx      # User avatar dropdown (placeholder)
└── lib/
    ├── types.ts          # FleetRow and MonthData interfaces
    └── dataUtils.ts      # Number parsing, currency formatting, aggregation helpers
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
