# Feature: Reports Dashboard

## What it does

The Reports Dashboard provides a visual overview of test quality metrics for a project. It presents pass/fail/blocked rate charts, trend analysis over time (pass rate across multiple runs), test coverage (cases executed vs total), and per-suite breakdowns. Reports can be exported to Excel or PDF for sharing with stakeholders.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | View reports for any project; export to Excel/PDF |
| **Lead** | View and export reports for their projects |
| **Tester** | View reports for projects they participate in |
| **Read Only** | View reports read-only; can export |

## Key behaviours

### Overall Pass Rate card (Dashboard)

- Headline value is the **arithmetic mean of each completed run's own pass rate** in the current scope (plan-080): `mean(run.progress.pass_rate)` over every run where `status === "completed"` and `progress.pass_rate != null`. Every completed run counts equally — a run with 1 result and a run with 1,000 results each contribute one data point. This deliberately differs from `sum(passed)/sum(total)`, which would let a single high-volume run dominate.
- Runs with **zero results** (completed but empty) are skipped — their own `pass_rate` is `null`, so they contribute nothing to either the numerator or the denominator of the mean.
- Data source is `testRunsStore.allRunsFlat` (already loaded for the trend chart), not a bulk-stats reducer — the raw-count fields attempted in plan-079 were reverted.
- When a **Select Run** filter is active, the headline collapses to that single run's own pass rate (`run.progress.pass_rate`) and the sublabel reads `"Run: <name>"`.
- The **per-project breakdown list** beneath the headline shows each project's `s.pass_rate` from `/projects/stats` — backend api plan-041 applies the identical mean-of-run-rates rule per project, so the breakdown numbers are consistent with the headline (the headline averages across all runs in scope; each breakdown row averages across one project's runs). Capped at **5 rows**; a "View all in Reports" link appears when more projects exist. A single-project filter collapses the breakdown to just the headline.
- The headline is **always green** (`var(--status-passed)` via the `.pass-rate-value` class). Prior threshold-based colouring (`text-success` at ≥80, `text-warning` at 60–79, `text-danger` below 60) is removed (plan-080) — matches the Reports KPI and per-run progress bars' "pass rate always green" convention.
- A `null` overall (no completed runs with results anywhere in scope) renders as an em-dash.

### Per-project breakdown panel (`/reports`, all-projects mode)

- `src/components/reports/PerProjectBreakdown.vue` — read-only `DataTable` with one row per in-scope project. Columns: project name (with an "archived" tag where applicable), total runs, completed runs, total results, overall pass rate (rendered green via `.pass-rate-value` to match the dashboard convention).
- Row click emits `select(projectId)`; the view calls `projectsStore.setSelectedProject(id)` which flips the global selector. The page rehydrates in per-project mode without a full reload.
- Empty scope (no projects, or no projects matching the explicit `project_ids` filter) renders a "No projects in scope." hint.

### Export in all-projects mode

- The Export PDF / Export Excel buttons are **disabled** in all-projects mode with a tooltip "Select a single project to export". `useExcelExport` and `usePdfExport` are written around a single project's test cases and a single run's results — calling them with cross-project data would silently produce a wrong export. Multi-project export is tracked in tech debt.
- The export run dropdown (when in per-project mode, or when re-enabled later for cross-project export) labels each option with `<project_name> · <run_name>` whenever the run carries a `project_name` so two runs sharing a name across projects are distinguishable.

### Select Run filter (Dashboard)

- A PrimeVue `Select` in the page header with placeholder `"All runs"` and a clear button. Options are sourced from `filteredTestRuns` — i.e. narrowed by the current project filter if one is active.
- When a run is selected, these panels scope to just that run: the four metric cards (`totalTestRuns=1`, `activeRuns`, `totalTestCases`, overall pass rate), the Test Results Distribution doughnut, and the Recent Test Runs list. The **Pass Rate Trend** line is intentionally left aggregated — a single-run trend is not meaningful.
- The selection is **local view state only** — no persistence, no URL sync. It clears automatically whenever the global selected project changes so a stale run id from the prior project never leaks into metrics.

### Overall Pass Rate KPI + trend chart (`/reports`)

- The backend returns `overall_pass_rate` and per-day `trend[].pass_rate` as a **0..1 ratio** (api plan-035). `ReportDashboardView` converts both to a 0..100 percentage at render time via `toPercent` from `src/utils/passRate.ts` (e.g. a ratio of `0.8` renders as `"80.0%"`).
- `overall_pass_rate` is the arithmetic mean of each completed run's own pass rate for the selected project (api plan-041) — the same rule the Dashboard applies to its overall tile. Runs with zero results don't contribute. The Reports KPI card is labelled **"Overall Pass Rate"** (renamed from "Average Pass Rate" in plan-079). The KPI is always rendered in canonical passed green (`#22c55e`) — the old 60/80 traffic-light classes (`text-success`/`text-warning`/`text-danger`) and the two conditional "below 80" / ">= 90" insight banners were removed to match the dashboard's "pass rate always green" convention.
- The **Pass Rate trend** line colour also uses passed green. Days with `pass_rate: null` (no activity, `total === 0`) are preserved as `null` in the Chart.js dataset and render as **gaps** via `spanGaps: true` — no more false zeros on quiet days. A response where every day is `null` falls through to the existing "No data" empty-state branch.

### Automation Coverage donut (`/reports`)

- The donut reads `test_case_distribution.by_automation.{automated, manual}` from the analytics response. The backend (api) counts a case as automated when its user-facing `type` field equals `'automated'` — not when `automation_id` (CI linkage id) is populated. So a case marked "automated" without a linked CI id still registers as automated on the donut. Before this fix every project that hadn't wired CI showed 100% manual here regardless of the case classification.
- `metrics.automation_coverage` = `round(automated / summary.total_test_cases * 100, 1)`. Displayed inline under the chart.

### Dashboard doughnut leader-line labels

- `DoughnutChart` (`src/components/charts/DoughnutChart.vue`) registers a local Chart.js plugin (`leaderLineLabelsPlugin`) that draws a 2-segment leader line from each non-zero arc's outer midpoint to a `"<Label> <n.n>%"` callout. Zero-value slices are skipped (they still appear in the side legend).
- Percentages are computed from the dataset sum (self-contained) and rounded to one decimal. Text colour uses the `--text-color` CSS var (fallback `#334155`) so labels stay legible in both themes.
- The component merges generous `layout.padding` onto caller options so labels don't clip at standard dashboard widths. Only the dashboard's Test Results Distribution uses this wrapper today; the reports automation-coverage doughnut continues to render via `vue-chartjs`'s `Doughnut` directly and is unaffected.

### Data fetching

- Entry point: `ReportDashboardView` at `/reports`.
- Renders in two **modes** derived from the global project selector — `mode = computed(() => projectsStore.selectedProjectId ? 'project' : 'all')`. Single source of truth; no local mode toggle.
- **Per-project mode** (`mode === 'project'`): loads from `getProjectReportAnalytics(projectId, { date_from?, date_to?, run_status?, include_trend? })` → `GET /projects/:id/report-analytics` — returns `ProjectReportAnalytics` (project summary, runs[], distributions, trend).
- **All-projects mode** (`mode === 'all'`, plan-082): loads from `getCrossProjectReportAnalytics({ project_ids?, date_from?, date_to?, run_status?, include_trend?, include_archived? })` → `GET /reports/analytics` — returns `CrossProjectReportAnalytics`, same shape minus `project_id`, plus `project_ids: number[] | null` and `per_project: PerProjectAnalyticsRow[]`. The page header badge reads "All projects". Aggregation rules are the same as per-project (mean of every completed run's own pass rate across the whole scope; per-project breakdown rows apply the rule per project so each row matches `/projects/stats`).
- The store keeps **two slots side-by-side** — `analytics` (per-project) and `crossProjectAnalytics` (all-projects). On selector flip the view wipes the now-inactive slot synchronously before the new fetch resolves so a stale shape never leaks into a chart.
- Both modes share the same chart pipeline via an `activeAnalytics` computed (`crossProjectAnalytics ?? analytics`), so KPI cards, distribution donut, automation donut, and pass-rate trend render identically.
- The call goes through `stores/reports`; the view imports from the store, never from `src/api/`.
- Replaces the previous N+1 pattern where the view looped `testResultsStore.fetchResults(run.id)` once per run to compute the same numbers client-side.
- Related endpoints still exist for other flows but are not used by this view:
  - `getDashboardData` (home dashboard), `getProjectMetrics` (legacy metrics widget), `getTestRunMetrics` / `downloadReport` (per-run report page)
- The **export dialog** lazy-loads the richer shapes it needs when opened: `testCasesStore.fetchTestCases(projectId)` for the PDF/Excel payload and `testRunsStore.fetchTestRuns(projectId)` to resolve the selected `TestRun` object. Per-run `testResultsStore.fetchResults(runId)` fires only for the specific run the user picks — never in a loop.
- Charts are rendered with **Chart.js 4** + **vue-chartjs**:
  - Doughnut chart for overall pass/fail distribution
  - Line chart for pass rate trend over time
  - Bar chart for per-suite result breakdown
- **Client-side export** (Excel and PDF) uses `useExcelExport` (ExcelJS) and `usePdfExport` (jsPDF + jspdf-autotable) respectively — no backend involved.
- The PDF export preserves rich text formatting (bold, italic, bullet and numbered lists, headings) in test case descriptions, preconditions, and steps. `usePdfExport.parseHtmlToBlocks` converts Tiptap HTML into styled-word block tokens and `renderFormattedHtml` lays them out with jsPDF's per-run font switching and manual word-wrap. Step table cells (which `jspdf-autotable` can't carry inline styles into) use a lighter `htmlToFormattedText` converter that preserves list markers and paragraph breaks but drops bold/italic. Comments remain plain-text-stripped.
- **Server-side export** via `downloadReport` returns a pre-rendered PDF or Excel blob generated by the backend.
- The project selector in the view header allows switching between projects without navigating away.

## Constraints / edge cases

- The trend chart has a **date range filter** (`DatePicker` in range mode). Defaults to the last 30 days and is passed to the backend as the `date_from` / `date_to` query params — the backend-side filter on `TestRun.completed_at` (falling back to `created_at`) drives both the `runs` list and the `trend` series. Changes to the date range are debounced 200 ms to avoid thrashing while the user drags.
- `summary` totals (test cases, test runs, overall pass rate, result distribution) are **project-wide** and are not narrowed by the date range — only `runs` and `trend` are windowed.
- Report data is **not real-time** — it reflects a snapshot at the time of the API call. Refreshing the page fetches fresh data.
- PDF chart export (client-side) requires capturing the Chart.js canvas as a PNG via `canvas.toDataURL()`. Charts must be fully rendered before export is triggered; premature export will produce blank charts.
- Client-side Excel/PDF export is entirely browser-side — large datasets may cause brief UI freeze during generation.
- The trend chart requires at least 2 days with activity to show a meaningful line; fewer points render a single point or an empty state.
- Report data comes directly from the backend API.

## Related docs

- `docs/06-generated/api-schema.md` — `reports` API endpoints
- `docs/06-generated/routes-map.md` — `/reports`
- `src/types/report.ts` — `ProjectReportAnalytics`, `RunAnalyticsItem`, `TestCaseDistribution`, `TrendPoint`, `ReportAnalyticsSummary`, `ReportAnalyticsParams`
- `src/api/reports.ts`
- `src/stores/reports.ts`
- `src/views/reports/ReportDashboardView.vue`
- `src/composables/useExcelExport.ts`
- `src/composables/usePdfExport.ts`
- `src/composables/usePassRateAggregation.ts`
- `docs/03-engineering/patterns/charts.md`
