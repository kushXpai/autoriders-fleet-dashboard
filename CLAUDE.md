# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint over the whole project
npx tsc --noEmit  # Type-check without emitting
```

No test suite is configured.

## Architecture

This is a Next.js App Router application (`app/` directory). All pages and API routes live under `app/`.

### Data flow

- On load, `app/page.tsx` fetches all fleet rows from `GET /api/data` and stores them in `allData` state. All filtering, aggregation, and chart data are derived client-side with `useMemo` — there are no re-fetches when filters change.
- The Revenue Intelligence tab (developer role only) lazily fetches from `GET /api/revenue` when first activated.
- Uploads hit `POST /api/upload` (fleet) or `POST /api/revenue`, then re-fetch the GET endpoint.

### Storage

AWS DynamoDB (region `ap-south-1`), two tables:
- **`fleet_rows`** (`DYNAMODB_TABLE_NAME`): pk=`BRANCH#<branch>`, sk=`<year>#<month>#<regNo>#<srNo>`
- **`autoriders-revenue`** (`REVENUE_TABLE_NAME`): pk=`REVENUE#<invoiceMonth>`, sk=`<bookingRef>#<rowIndex>`

DynamoDB client singleton is in `app/lib/dynamodb.ts`.

### Authentication

Client-side only. `app/lib/auth.ts` holds hardcoded credentials (no server-side session validation). `authenticate()` does a plain-text lookup; the session is stored in `localStorage` under key `fleet_user`. There is no Next.js middleware enforcing the redirect — `app/page.tsx` calls `getStoredUser()` to gate role-based UI.

Roles: `developer`, `superadmin`, `admin`, `branch`. The `developer` role unlocks the Revenue Intelligence tab.

### Key shared utilities

- `app/lib/types.ts` — `FleetRow` and `MonthData` interfaces
- `app/lib/dataUtils.ts` — `num()`, `cr()`, `aggregateByVehicle()`, `getActivePct()` and other aggregation helpers used everywhere
- `app/components/FilterBar.tsx` — Multi-select filters (branch, FY, month, model, status); drives `allData` slicing in `page.tsx`

### Styling

Tailwind CSS v4 (PostCSS integration via `@tailwindcss/postcss`). No component library — UI is custom CSS + Tailwind utilities. Design tokens and animations are in `app/globals.css`. Fonts: Outfit (body) + Syne (headings) loaded via CSS `@import`.

### Environment variables

See `.env.example`:
```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
DYNAMODB_TABLE_NAME=fleet_rows
REVENUE_TABLE_NAME=autoriders-revenue
```
