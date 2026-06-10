# Feature: Project Management

## What it does

Project Management is the top-level organizational unit in Testoria. Users create projects with a display name and optional description. Each project acts as an isolated container for test suites, test cases, and test runs. Projects can be archived when no longer active. A stats summary (total cases, suites, runs, pass rate) is available per project.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Create, edit, archive, delete any project |
| **Lead** | Create projects; edit and archive projects they own |
| **Tester** | View projects and their stats; cannot create or modify |
| **Read Only** | Read-only access to project list and stats |

## Key behaviours

- A project requires a **name**. Description is optional.
- **Project management actions on `/projects/:id`** (plan-091, fixes TES-71). The project detail page exposes the same management affordances as the list view: **Edit** (`isProjectManager` / lead+) opens the shared `EditProjectDialog` for renaming, description edit, and archive toggle; **Delete** (`isAdmin`) uses `useConfirm()` with a cascade-warning message and routes to `/projects` on success. The Edit dialog is extracted to `src/components/projects/EditProjectDialog.vue` and consumed by both `ProjectListView` and `ProjectDetailView` — single source of truth for validation, payload shape, and toast copy.
- Projects have an `is_archived: boolean` flag — archiving a project hides it from default list views but preserves all data.
- The **Show archived** checkbox on `/projects` (plan-085, fixes TES-82) is **server-driven** via `?include_archived=true` against `GET /projects`. `ProjectListView` watches the toggle and re-fetches on every change; there is no client-side filter on `is_archived`. The shared `projectsStore.projects` then holds archived rows whenever the toggle is on, but other consumers (`AppHeader.vue`, `TestRunCreateView.vue`, `usePassRateAggregation.ts`) all filter `!p.is_archived` locally before rendering, so global selectors and pass-rate aggregations are unaffected.
- `getProjectStats(id)` returns a `ProjectStats` object with: `total_test_cases`, `total_test_runs`, `total_test_suites`, `pass_rate` (a 0..1 ratio rounded server-side to 3 decimals — api plan 044). The `Pass Rate` tile on `ProjectDetailView` renders via `formatPassRate` (1-decimal percent — plan-083); the previous bug that displayed the raw ratio with a `%` suffix is fixed.
- The project list supports filtering and pagination via `PaginatedResponse<Project>`.
- `ProjectDetailView` shows the project overview, stats (all four metrics including suite count), description (when present), and action buttons for Test Cases, New Test Suite, and New Test Run.
- The **New Test Suite** button opens an inline `<Dialog>` (name + description) and calls `testSuitesStore.createTestSuite` directly — it does not navigate away from the project detail page. Project stats are refetched on success so the "Test Suites" tile updates immediately.
- When `is_archived === true`, the **New Test Suite** and **New Test Run** buttons in `ProjectDetailView` are disabled and display a tooltip explaining why. This is a UI-only guard — the backend remains authoritative.
- Deleting a project is a destructive operation available only to Admins; it removes all nested suites, cases, runs, and results.

## Constraints / edge cases

- Archived projects (`is_archived: true`) are excluded from suite-scoped operations (e.g. creating a new test run inside an archived project should be blocked).
- Stats are fetched separately from the project record (`getProjectStats`) and may be stale if test results change between calls — they are not real-time.
- Role checks use `stores/auth` flags (`isAdmin`, `isProjectManager`) — never read `user.role` directly in components.

## Related docs

- `docs/02-architecture/ARCHITECTURE.md` — layer flow and invariants
- `docs/06-generated/api-schema.md` — `projects` API endpoints
- `docs/06-generated/routes-map.md` — `/projects`, `/projects/:id`
- `src/stores/projects.ts` — state management
- `src/api/projects.ts` — HTTP boundary
- `src/views/projects/ProjectListView.vue`, `src/views/projects/ProjectDetailView.vue`
