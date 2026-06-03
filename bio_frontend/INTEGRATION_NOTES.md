# BioLab AI UI integration notes

This package integrates the latest simplified BioLab AI UI/UX concept into the previous Next.js frontend while preserving the old application logic.

## Kept from the old frontend

- Next.js App Router structure.
- `/api/backend/[...path]` proxy route.
- `src/lib/api.ts` backend client.
- Gene search endpoint: `/api/v1/genes/search`.
- Gene detail route: `/genes/[id]`.
- Sequence analysis endpoint: `/api/v1/sequence/analyze`.
- API Explorer calls for health, system status and PubMed.
- Multi-provider fallback query params: `provider` and `fallback`.

## Integrated from the new UI

- Dark compact sidebar.
- Cleaner header without duplicated global search input.
- Dashboard focused on three primary actions: search, analyze, visualize.
- Gene Search page with centered search bar and collapsible advanced filters.
- Advanced filters keep: data type, search by, mode, provider, organism and multi-provider fallback.
- Cleaner result cards and empty/loading/error states.
- Simplified Sequence Analysis dashboard with GC donut and nucleotide bars.
- Settings/System area no longer competes with primary features.

## Important files changed

- `src/app/BioLabDashboardClient.tsx`
- `src/app/globals.css`
- `src/lib/api.ts`

## Run locally

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

If dependencies were installed before, clean first:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install
npm run dev
```

## Backend requirement

Make sure FastAPI is running on the backend URL configured in `.env.local`, for example:

```env
BACKEND_INTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_KEY=dev-key-1
```

If running in Docker, use the backend service name instead of `127.0.0.1` for `BACKEND_INTERNAL_URL`.

## Gene Detail UI update
- Rebuilt `src/app/genes/[id]/GeneDetailClient.tsx` using the provided bento-style Gene Detail concept.
- Kept the existing backend contract: `api.geneDetail(id)`, browser session cache, provider links, FASTA/sequence, transcripts, protein features, metadata and fallback warnings.
- Added tabs: Overview, Sequence, Visualization, Metadata.
- Added copy FASTA/sequence, wrap text toggle, GC donut, nucleotide composition bars, source metadata cards and functional domain cards.
- Verified TypeScript with `npx tsc --noEmit`.

## Modern Collapsible Sidebar update

Added a desktop collapsible sidebar to `src/app/BioLabDashboardClient.tsx`:

- Expanded width: `lg:pl-72`, full logo/menu labels/status/fallback note.
- Collapsed width: `lg:pl-20`, icon-only navigation with hover tooltips.
- Smooth width and main-content padding transition.
- Mobile drawer remains expanded and opens from the hamburger button.
- Active menu indicator, New Analysis shortcut, and backend status dot are preserved.

Checked with:

```bash
npx tsc --noEmit
```

## 2026-06-01 - Bilingual EN/VI mode

Added a lightweight bilingual layer for Vietnamese and English:

- New file: `src/lib/i18n.tsx`
  - `useLanguage()` hook
  - `LanguageToggle` component
  - `localStorage` persistence via `biolab:language`
  - shared event sync for dashboard and gene detail pages
- Updated `src/app/BioLabDashboardClient.tsx`
  - language toggle in top header
  - translated main navigation, dashboard, gene search, sequence analysis, API explorer and key result labels
- Updated `src/app/genes/[id]/GeneDetailClient.tsx`
  - language toggle in detail header
  - translated key gene detail labels, tabs, loading, status, copy/wrap controls and empty state

Validation:

- `npx tsc --noEmit` passed.
- `npm run build` compiled successfully and passed type checks, but timed out later during Next.js page data collection in the sandbox environment.

## Gene Detail data-type aware UI update
- Protein detail no longer shows GC Content or nucleotide composition by default.
- Protein detail shows Protein Length, estimated Molecular Weight, Amino Acid Composition, Functional Domains, and UniProt/provider annotation.
- Nucleotide detail shows GC Content, Nucleotide Composition, Reverse Complement, RNA Transcript, and Nucleotide FASTA.
- Gene detail automatically switches layout by data_type/sequence_type/source/provider.
