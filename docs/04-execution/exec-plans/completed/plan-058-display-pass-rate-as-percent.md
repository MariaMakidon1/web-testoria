# Execution Plan: Display `pass_rate` as a percentage on `/test-runs/:id` and `/test-runs/:id/execute`

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

On the two test-run pages — `/test-runs/:id` and `/test-runs/:id/execute` — treat the API's `pass_rate` as a `0..1` ratio and scale by `× 100` at display time. Today both pages format the raw ratio directly, so an 80%-passing run currently renders as **"0.8%"**.

Scope is strictly the two pages named above. Dashboard, test-run list, reports, and every other consumer are out of scope and tracked separately.

---

## Context

Api plan 035 makes the backend `pass_rate` contract uniform: `float | None` in `[0.0, 1.0]`, denominator covers every status (passed, failed, blocked, no_run, skipped, retest). This plan fixes the two pages that are visibly wrong on the current UI.

Concretely broken sites:

| File | Line | Current | Renders for 80% |
|---|---|---|---|
| `src/views/test-runs/TestRunDetailView.vue` | 220 | `(runProgress.pass_rate ?? 0).toFixed(1) + "%"` | **0.8%** |
| `src/views/test-runs/TestRunDetailView.vue` | 280 | `(runProgress.pass_rate ?? 0).toFixed(0) + "%"` | **1%** |
| `src/views/test-runs/TestRunExecutionView.vue` | 633 | `(runProgress.pass_rate ?? 0).toFixed(1) + "%"` | **0.8%** |

These three sites are the entire surface of this plan.

Component that lives inside the detail page tree and computes its own pass rate:

| File | Line | Current | Action for this plan |
|---|---|---|---|
| `src/components/test-runs/TestResultsList.vue` | 75, 91 | Local `passed / executed * 100` — own calc | Switch to `runProgress.pass_rate` (all-statuses ratio from api plan 035) formatted via the shared helper. Because this component is rendered *only* by `TestRunDetailView`, it's in scope of this plan. |

Explicitly **out of scope** for this plan:

- `src/views/dashboard/DashboardView.vue` (lines 77, 422–435) — already scales correctly; any cleanup is a separate plan
- `src/views/test-runs/TestRunListView.vue` (line 107–109) — `getProgressColor` thresholds
- Reports, CLI, CI badge integrations
- Any shared helper usage outside the two pages above

If, during the audit, a site outside the two pages looks wrong, log it as tech debt — do not expand this plan.

---

## Scope

### In scope (pages `/test-runs/:id` and `/test-runs/:id/execute` only)

- Introduce a small formatting helper `src/utils/passRate.ts`:
  - `formatPassRate(ratio: number | null | undefined, opts?: { decimals?: number; fallback?: string }): string` — e.g. `0.8 → "80.0%"`, `null → "—"`
  - `toPercent(ratio: number | null | undefined): number | null` — for callers that need the numeric percent (e.g. color thresholds scoped to these two pages, if any)
- Fix `TestRunDetailView.vue:220` → `formatPassRate(runProgress.pass_rate, { decimals: 1 })`
- Fix `TestRunDetailView.vue:280` → `formatPassRate(runProgress.pass_rate, { decimals: 0 })`
- Fix `TestRunExecutionView.vue:633` → `formatPassRate(runProgress.pass_rate, { decimals: 1 })`
- `TestResultsList.vue`: remove the local `passed / executed * 100` computation; read `runProgress.pass_rate` from the store and format via the helper. Keep the local `passed` / `failed` / `executed` counts if the component uses them for other labels — just stop computing its own percentage
- Null handling on both pages: `pass_rate == null` renders as `"—"`, not `"0%"` (current behaviour renders `0.0%` due to the `?? 0`)
- Unit tests for the helper (all edge cases: `null`, `undefined`, `0`, `1`, `0.8`, `0.123`)
- Component-level test (or snapshot) that, given `runProgress.pass_rate = 0.8`, the detail page renders `"80.0%"` and `"80%"` at the two binding sites
- E2E smoke on both pages: seeded run with 8 passed / 2 failed → displayed pass rate reads `80.0%` / `80%`, never `0.8%` or `1%`
- Dark-mode visual check on both pages

### Out of scope

- Dashboard, test-run list, reports, CLI, CI badge — any fix there is a separate plan
- Backend contract (owned by api plan 035)
- Locale-specific number / percent formatting — stay with `%` suffix and `toFixed`
- Renaming `pass_rate` in the web types
- Any visual redesign — only the rendered number changes

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| util | `src/utils/passRate.ts` (**new**) | `formatPassRate`, `toPercent`; tiny pure module |
| views | `src/views/test-runs/TestRunDetailView.vue` | Lines 220, 280 — replace inline format with `formatPassRate` |
| views | `src/views/test-runs/TestRunExecutionView.vue` | Line 633 — replace inline format with `formatPassRate` |
| components | `src/components/test-runs/TestResultsList.vue` | Drop local `passRate` computation; bind to `runProgress.pass_rate` via the helper |
| tests | `tests/unit/utils/passRate.spec.ts` (**new**) | Helper edge cases |
| tests | `tests/unit/views/TestRunDetailView.spec.ts` (new or existing) | Assert `0.8 → "80.0%"` at the rendered binding |
| tests | `tests/unit/views/TestRunExecutionView.spec.ts` (new or existing) | Same |
| e2e | `tests/e2e/test-run-detail.spec.ts`, `tests/e2e/test-run-execute.spec.ts` | Seeded-run assertion |

### Key decisions

- **Keep the blast radius to two pages.** The broader repo also has ad-hoc formatting, but scoping this plan strictly means reviewers see a small, auditable diff. Anything outside the two pages (and the one nested component) is tech-debt material.
- **One helper, used only in these pages for now.** Placing the helper in `src/utils` keeps it available for future migrations without forcing them in this plan. Other pages keep their current behaviour until their own plan picks it up.
- **Scale once at display.** Stores / composables keep the raw ratio from the API. Only the rendered `<span>` formats. No in-store mutation of `pass_rate`.
- **Null renders as `"—"`, not `0%`.** Runs with zero scope / pre-run state return `null` from api plan 035. "—" avoids implying a real zero.
- **`TestResultsList.vue` is included** because it renders inside `TestRunDetailView` and its own pass-rate line would contradict the parent page's fix. Limiting the plan to the two routes implies limiting the components those routes render.
- **Defensive clamp during overlap with api plan 035 rollout.** `toPercent` includes a guard: if the input is `> 1.5`, treat as already-scaled and pass through (with a single `console.warn`). Prevents a "50% → 5000%" regression if 035 rollout lags on a staging environment. Remove the guard once 035 is live everywhere — logged as a follow-up.

---

## Tasks

### Implementation
- [ ] Confirm api plan 035 status — if not merged, add a note in both view files that `pass_rate` may still be 0..100 on older backends; the helper's defensive clamp handles it
- [ ] Add `src/utils/passRate.ts`; unit test it
- [ ] `TestRunDetailView.vue:220` → `formatPassRate(runProgress.pass_rate, { decimals: 1 })`
- [ ] `TestRunDetailView.vue:280` → `formatPassRate(runProgress.pass_rate, { decimals: 0 })`
- [ ] `TestRunExecutionView.vue:633` → `formatPassRate(runProgress.pass_rate, { decimals: 1 })`
- [ ] `TestResultsList.vue`: remove the local `passRate` field from the reducer (or keep it only if used internally for non-display logic); switch any rendered pass-rate binding to `formatPassRate(runProgress.pass_rate, { decimals: 1 })`
- [ ] Grep within these three files for `.toFixed` + `%` — confirm no other inline format remains
- [ ] Unit tests:
  - [ ] Helper: `null → "—"`, `undefined → "—"`, `0 → "0.0%"`, `1 → "100.0%"`, `0.8 → "80.0%"`, `0.123 → "12.3%"` (decimals:1), `0.8 → "80%"` (decimals:0)
  - [ ] View binding: mount `TestRunDetailView` with `runProgress.pass_rate = 0.8` → rendered output contains `"80.0%"` at line 220's binding and `"80%"` at line 280's binding
  - [ ] View binding: mount `TestRunExecutionView` with `runProgress.pass_rate = 0.8` → `"80.0%"`
  - [ ] Null case: `runProgress.pass_rate = null` on both views → renders `"—"`, not `"0.0%"`
- [ ] E2E: seed a run with 8 passed / 2 failed; open `/test-runs/:id` → `"80.0%"`; open `/test-runs/:id/execute` → `"80.0%"`
- [ ] Dark-mode visual check on both pages

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build`
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — note `pass_rate` is a `0..1` ratio (link to api plan 035)
- [ ] `docs/02-architecture/frontend/components.md` — note `src/utils/passRate.ts` exists and is used by the two test-run pages; other consumers migrate in follow-up plans
- [ ] `docs/08-decisions/changelog.md` — record: fixed the `"0.8%"` bug on `/test-runs/:id` and `/test-runs/:id/execute`; scope intentionally limited to those two pages
- [ ] `docs/04-execution/tech-debt.md` — add follow-ups: (a) migrate `DashboardView.vue` and `TestRunListView.vue` to `formatPassRate` / `toPercent`, (b) remove the defensive clamp in `toPercent` once api plan 035 is confirmed rolled out, (c) audit reports / CLI for any remaining inline formatting
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Api plan 035 not yet rolled out on staging; `pass_rate` still comes as `0..100` | Medium | `toPercent` defensive clamp (`> 1.5 → pass-through`) covers transition window; follow-up removes the clamp |
| The defensive clamp silently hides a real `>100%` bug | Low | `console.warn` once per session; unit test asserts the warn fires for `1.5+` |
| `TestResultsList.vue` loses a label some other flow reads | Low | Audit the component's template for `passRate` usages; keep the field if referenced by non-display code, only change the rendered site |
| Null handling change (`0%` → `"—"`) surprises users mid-run | Low | Only fires when `pass_rate` is `null`; a running run always has a real ratio — impact limited to freshly created runs |
| Other pages (dashboard, list) still show inconsistent formatting | Expected | Out of scope by design; tech-debt entry scheduled |
| E2E seeded fixture drifts from expected counts and `"80.0%"` fails | Low | Assert against the rendered ratio derived from the seed's own numbers, not a hard-coded string |

---

## Definition of done

- [ ] `/test-runs/:id` renders the pass rate as `ratio × 100` with a `%` suffix at both bindings (lines 220, 280)
- [ ] `/test-runs/:id/execute` renders the pass rate as `ratio × 100` with a `%` suffix at line 633
- [ ] `TestResultsList.vue` no longer computes its own pass rate; reads `runProgress.pass_rate` via the helper
- [ ] Null `pass_rate` renders as `"—"` on both pages
- [ ] No other page or component is touched by this PR
- [ ] Unit tests cover the helper and the three bindings; e2e confirms the two pages
- [ ] Docs updated; follow-up migrations logged as tech debt
- [ ] PR checklist completed
