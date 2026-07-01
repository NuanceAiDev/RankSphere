# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RankSphere** — a SEO rank-tracking dashboard built for Nuance Digital Solutions to manage multiple clients and monitor keyword rankings month-over-month. All source code lives inside `RankSphere/`.

## Commands

All commands must be run from inside the `RankSphere/` directory.

```bash
cd RankSphere

npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # TypeScript compile + Vite production build
npm run lint         # ESLint (flat config, eslint.config.js)
npm run preview      # Serve the production build locally

# Supabase Edge Functions (rarely used)
npm run deploy:ga4   # Deploy fetch-ga4-analytics edge function
npm run deploy:test  # Deploy test-ga4 edge function
```

There is no test suite. Type-checking is done via `tsc --noEmit` (run manually or as part of `build`).

## Environment Variables

Copy `RankSphere/.env.example` to `RankSphere/.env` and fill in:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

The `VALUESERP_API_KEY` must be set as a **server-side** Vercel environment variable (not `VITE_` prefixed) — it is intentionally never exposed to the browser. The Vercel serverless proxy at `api/fetch-rank.ts` reads it server-side.

## Architecture

### Stack
- **React 18 + TypeScript** with Vite
- **Tailwind CSS** for styling (dark/light mode via `ThemeContext`)
- **Supabase** (PostgreSQL + Storage + Auth)
- **React Router v7** (single-page, two routes: `/login` and `/`)
- **Recharts** for charts, **jsPDF** for PDF report generation
- **Vercel** for deployment; serverless API routes in `api/`

### Key Architectural Decisions

**Vercel Proxy for SERP API**: The browser never calls ValueSERP directly. `src/lib/valueserp.ts` calls `/api/fetch-rank`, a Vercel serverless function (`api/fetch-rank.ts`) that injects the API key server-side. This prevents key exposure and eliminates CORS issues.

**State lives in `App.tsx`**: `clients` and `keywords` arrays are loaded once at the top level (`Dashboard` component) and passed down as props. Child components call `onKeywordAdded` / `onClientUpdated` callbacks to trigger re-fetches. There is no global state library (no Redux/Zustand).

**Mock Supabase client**: When env vars are absent, `src/lib/supabase.ts` returns a mock client that throws user-friendly errors instead of crashing. The `isSupabaseConfigured` boolean guards write operations.

**RBAC via `profiles` table**: `AuthContext` fetches the user's `role` (`admin` / `viewer`) from `public.profiles` after login. The role is used in child components to show/hide write actions. New users default to `viewer`; promote to `admin` manually in Supabase Table Editor.

**Rank type per client**: Each `Client` record has a `rank_type` field (`'dubai'` | `'qatar'`), which controls the geo-parameters sent to ValueSERP. The `RankTypeToggle` component in the Keywords tab writes this back to Supabase.

**Monthly refresh window**: The "Fetch Ranks" button in `Keywords.tsx` is only enabled between the 27th of one month and the 13th of the next (`isMonthlyRefreshAllowed()`). When fetching, `current_month_rank` shifts to `previous_month_rank` before the new value is written.

### Directory Structure

```
RankSphere/
├── api/                    # Vercel serverless functions (Node.js, not bundled by Vite)
│   ├── fetch-rank.ts       # ValueSERP proxy — keeps API key server-side
│   └── bulk-refresh.ts     # Bulk rank refresh endpoint
├── src/
│   ├── App.tsx             # Root: routing, Dashboard state (clients + keywords)
│   ├── types/index.ts      # All shared TypeScript interfaces
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client + retryOperation utility
│   │   └── valueserp.ts    # fetchKeywordRanking — calls /api/fetch-rank proxy
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Supabase Auth + profiles RBAC
│   │   └── ThemeContext.tsx # Dark/light mode toggle
│   └── components/
│       ├── Keywords.tsx    # Add/delete keywords, trigger rank fetches
│       ├── Rankings.tsx    # Report tab — PDF generation, analytics screenshots
│       ├── Analytics.tsx   # Screenshot upload/management (Supabase Storage)
│       ├── Overview.tsx    # Agency-level dashboard view
│       └── Sidebar.tsx     # Client list navigation
├── supabase/
│   ├── migrations/         # Sequential SQL migrations for Supabase
│   ├── profiles_rbac.sql   # Run manually to set up RBAC profiles table
│   └── add_full_name.sql   # Adds full_name column to profiles
```

### Database Tables

| Table | Purpose |
|---|---|
| `clients` | Client name, domain, industry, rank_type, report tracking |
| `keywords` | Keyword text + current/previous month rank + dates, linked to client |
| `profiles` | RBAC roles (`admin`/`viewer`) linked 1:1 to `auth.users` |

Supabase Storage bucket `analytics_screenshots` stores images under `{client-slug}/{YYYY-MM}/` with 7-day auto-delete lifecycle rules.

### Analytics Screenshots Flow

Screenshots are uploaded in `Analytics.tsx` to the `analytics_screenshots` Storage bucket. During PDF generation in `Rankings.tsx`, the app lists files in the client's current-month folder and embeds public URLs into the jsPDF document.
