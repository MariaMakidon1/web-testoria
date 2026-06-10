# Execution Plan: Capitalise statuses in the Test Progress section, status filter dropdown, and result-card chip on `/test-runs/:id`

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

On `/test-runs/:id`, render every status label as a proper Title-Case word — "Passed", "Failed", "Blocked", "Skipped", "No Run", "Retest" — in three places that currently show a raw lowercase value:

1. The **Test Progress** section's per-status breakdown chips
2. The **status filter dropdown** above the results list
3. The **status chip on each result/test-case card** in the results list

Scope is strictly these three sites on this page. The chip fix lives in the shared `StatusBadge` component (unavoidable — it's the one chip used across the app), but only the `type="result"` branch changes, and the visual effect is a pure label-casing improvement.

---

## Context

Two adjacent defects on the same page:

### 1. Status filter dropdown — always lowercase

`src/components/test-runs/TestResultsList.vue:32-37` builds options directly from the raw status literal:

```ts
const statusOptions = computed(() => {
  return [
    { label: "All Statuses", value: "all" },
    ...RESULT_STATUSES.map((s) => ({ label: s, value: s })),   // label === value === "passed" | "failed" | …
  ];
});
```

So the dropdown renders `passed`, `failed`, `blocked`, `skipped` in all-lowercase, right next to the "All Statuses" option that is Title-Case.

### 2. Result-card status chip — always lowercase

`src/components/test-runs/TestResultCard.vue:85` renders the chip via the shared badge:

```vue
<StatusBadge :value="result.status" type="result" size="small" />
```

`StatusBadge` (`src/components/common/StatusBadge.vue:104-111`) passes `value` straight through to PrimeVue's `<Tag :value="value">`:

```vue
<Tag
  :value="value"
  :severity="badgeConfig.severity"
  :icon="badgeConfig.icon"
  …
/>
```

No label transformation. So every result card on the detail page reads `passed` / `failed` / `blocked` / `skipped` in all-lowercase. Fixing this in `TestResultCard` alone would leave every other `type="result"` consumer inconsistent; the right place is `StatusBadge`, formatting the rendered value via the same `statusLabel` helper — but only for the `result` branch (priority / run / type each have their own label conventions and are out of scope of this plan).

### 3. Test Progress breakdown — lowercase for any status missing from the labels map

`src/views/test-runs/TestRunDetailView.vue:236-262` iterates a hardcoded object and looks up the label with a lowercase raw fallback:

```vue
<span class="breakdown-label">{{
  RESULT_STATUS_LABELS[status as ResultStatus] || status
}}</span>
```

Today `RESULT_STATUS_LABELS` (`src/types/testResult.ts:87-92`) covers only `passed | failed | blocked | skipped`. Any status that arrives through the union without a label — `no_run` (introduced by plan-054 / api plan 032), `retest` — falls through to the raw lowercase key. Once plan-054 lands, `no_run` will render as the literal string **"no_run"** in the breakdown.

The hardcoded list of statuses in the template (`passed`, `failed`, `blocked`, `skipped`) is also about to drift from `runProgress` as `no_run` enters the API payload (api plans 032 / 034). Both the ordering and the set of statuses rendered should come from a single source.

### Why one plan, three sites

All three bugs resolve to the same fix: one shared `statusLabel(status)` helper reading from `RESULT_STATUS_LABELS`, with a `snake_case → Title Case` fallback (so the day `retest` or a future `in_progress` status lands, nothing shows lowercase). Fixing all three at once avoids the awkward state where a detail-page view simultaneously shows a Title-Case breakdown chip ("Passed"), a lowercase dropdown option ("passed"), and a lowercase card chip ("passed") — which is exactly what would happen if any one of them shipped alone.

---

## Scope

### In scope (page `/test-runs/:id`)

- Extend `RESULT_STATUS_LABELS` in `src/types/testResult.ts` to cover every status the current `ResultStatus` union contains — explicitly including `no_run` → `"No Run"` and `retest` → `"Retest"` if/when those are in the union
- Add a single `statusLabel(status: string): string` helper in `src/utils/statusLabel.ts` (or co-located with `RESULT_STATUS_LABELS`) that:
  - Looks up `RESULT_STATUS_LABELS[status]` when present
  - Otherwise derives a Title-Case fallback by splitting on `_` / `-` and capitalising each word (`no_run` → `"No Run"`)
  - Returns `"—"` for null / undefined / empty string
- `TestRunDetailView.vue` — Test Progress breakdown:
  - Drive the iteration from the statuses present in `runProgress` (or from a single `RESULT_STATUSES` source), not a hardcoded literal object
  - Replace `RESULT_STATUS_LABELS[status] || status` with `statusLabel(status)`
  - Keep the color lookup via `RESULT_STATUS_COLORS` unchanged
- `TestResultsList.vue` — status filter dropdown:
  - Options built as `{ label: statusLabel(s), value: s }` (value stays lowercase — it's what the API uses)
  - "All Statuses" entry unchanged
- `StatusBadge.vue` — **shared component**; change the `type="result"` branch to render `statusLabel(value)` as the Tag's display value while `value` (the prop) stays the raw status for callers and color lookups. Other `type=` branches (`priority`, `run`, `type`, `custom`) are untouched by this plan
- `TestResultCard.vue` — no change needed at the call site; the badge fix flows through
- Unit tests for `statusLabel` (covers every current union value, one unknown key, null / undefined)
- Component-level tests asserting:
  - The breakdown renders "Passed", "Failed", "Blocked", "Skipped" (and "No Run" if `no_run` is in `runProgress`)
  - The filter dropdown renders "Passed" / "Failed" / "Blocked" / "Skipped" (not the lowercase raw values)
  - `StatusBadge` with `type="result" value="passed"` renders the visible text "Passed"; with `type="priority" value="high"` it renders unchanged (regression guard)
- Dark-mode visual check on the three affected areas
- Docs: brief mention in the component docs that result-status display goes through `statusLabel`; note the `StatusBadge` behavioural change

### Out of scope

- Capitalising statuses on other pages (`/test-runs/:id/execute`, dashboard, list view, reports) — they *will* receive an incidental improvement anywhere they use `<StatusBadge type="result">`, but no audit or edit of those views is part of this plan
- Changing `StatusBadge` behaviour for `type="priority"`, `type="run"`, `type="type"`, or `type="custom"` — separate follow-up if desired
- Changing the backend status literals
- Internationalisation of status labels (future concern)
- Restyling the breakdown chips, dropdown, or card chip beyond the label swap
- Changes to the underlying filter / search logic — purely a rendering change
- Adding new statuses to the union — this plan only reacts to what's already in the type

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testResult.ts` | Extend `RESULT_STATUS_LABELS` to include every `ResultStatus` variant present today (sync with the current union); add `no_run` and `retest` keys if those are in the union |
| util | `src/utils/statusLabel.ts` (**new**) | `statusLabel(status)`: map lookup + Title-Case fallback + null handling |
| views | `src/views/test-runs/TestRunDetailView.vue` | Drive the breakdown iteration from a dynamic list; replace inline `RESULT_STATUS_LABELS[…] \|\| status` with `statusLabel(status)` |
| components | `src/components/test-runs/TestResultsList.vue` | Option labels via `statusLabel(s)`; keep option `value` as the raw status |
| components | `src/components/common/StatusBadge.vue` | For `type="result"`, pass `statusLabel(value)` to the underlying `<Tag :value="…">` instead of the raw prop; prop API unchanged |
| tests | `tests/unit/utils/statusLabel.spec.ts` (**new**) | All edge cases |
| tests | `tests/unit/views/TestRunDetailView.spec.ts` | Breakdown renders Title-Case labels |
| tests | `tests/unit/components/TestResultsList.spec.ts` | Dropdown options are Title-Case |
| tests | `tests/unit/components/StatusBadge.spec.ts` | `type="result"` shows Title-Case; other types unchanged (regression) |
| e2e | `tests/e2e/test-run-detail.spec.ts` | Visible label strings on the page (breakdown, dropdown, card chip) |

### Key decisions

- **One helper, three sites.** Avoids a new inconsistency where the breakdown is Title-Case but the dropdown or card chip stays lowercase again after the next status-union addition.
- **Chip fix lives in `StatusBadge`, scoped to `type="result"`.** Patching `TestResultCard` alone would leave every other `type="result"` consumer (execute page card, future reports, etc.) inconsistent. Centralising the display format in `StatusBadge` is the correct place; restricting the change to the `result` branch keeps this plan from accidentally altering priority / run / type chips.
- **`StatusBadge` prop API does not change.** Callers still pass `:value="result.status"`. The component internally renders `statusLabel(value)` when `type === "result"`. Event / class / color behaviour is unchanged.
- **`statusLabel` does the fallback, `RESULT_STATUS_LABELS` is the source of truth.** The fallback is a safety net for unknown statuses (e.g. a backend rollout lands before the type is updated). The preferred path is always an explicit entry in the labels map.
- **Breakdown iteration becomes dynamic.** A hardcoded object in the template goes stale every time a status is added. Deriving from `runProgress` keys (or a central `RESULT_STATUSES` array) means adding `no_run` server-side doesn't require a frontend edit to appear in the breakdown.
- **Dropdown keeps raw lowercase values.** The filter value is still compared against `result.status` strings — changing that would cascade through store logic. Only the display label changes.
- **Acknowledged side effect of the `StatusBadge` change.** Every other page that renders `<StatusBadge type="result">` will also start displaying Title-Case labels. This is a welcome improvement, not a regression — but snapshot tests elsewhere may need refreshing. Call out in the PR description and sweep for affected tests.
- **No i18n pre-work.** The helper is structured so swapping to a translation function is a single find/replace later, but this plan doesn't take on i18n.

---

## Tasks

### Implementation
- [ ] Read the current `ResultStatus` union in `src/types/testResult.ts`; list every variant (cross-check against `RESULT_STATUSES`, `RESULT_STATUS_COLORS`, `RESULT_STATUS_ICONS`)
- [ ] Extend `RESULT_STATUS_LABELS` to cover every variant (e.g. add `no_run: "No Run"`, `retest: "Retest"` if present in the union); fail the TS build if any variant is missing (leverage the `Record<ResultStatus, string>` type — TypeScript already enforces this, so the fix is just adding the missing keys)
- [ ] Add `src/utils/statusLabel.ts` with `statusLabel(status)`; export a companion `statusLabelFallback(status)` for the snake_case → Title-Case derivation
- [ ] Unit tests for `statusLabel`:
  - [ ] Every union variant returns its mapped label
  - [ ] Unknown key `"foo_bar"` → `"Foo Bar"` (fallback works)
  - [ ] `null` / `undefined` / `""` → `"—"`
  - [ ] `"no_run"` → `"No Run"` (via map if in union, via fallback otherwise)
- [ ] `TestRunDetailView.vue`:
  - [ ] Replace the hardcoded `{ passed, failed, blocked, skipped }` literal with an iteration driven by either `RESULT_STATUSES` (typed list) or by `Object.entries(runProgress).filter(([k]) => RESULT_STATUSES.includes(k))`
  - [ ] Swap the label binding to `statusLabel(status)`
  - [ ] Verify `RESULT_STATUS_COLORS` has a matching entry for every rendered status; if a status has no color token, skip rendering its dot but keep the label (or log tech-debt)
- [ ] `TestResultsList.vue`:
  - [ ] `statusOptions` maps `RESULT_STATUSES` to `{ label: statusLabel(s), value: s }`
  - [ ] Visual audit: "All Statuses" stays first, others follow in `RESULT_STATUSES` order
- [ ] `StatusBadge.vue`:
  - [ ] Internal computed: `displayValue = props.type === "result" ? statusLabel(props.value) : props.value`
  - [ ] Template: `<Tag :value="displayValue" …>` (replace the raw `:value="value"`)
  - [ ] Confirm the color / severity / icon lookups keep using the raw `props.value` (unchanged)
  - [ ] Sweep repo for existing snapshot tests asserting lowercase result labels (`'passed'`, `'failed'`, `'blocked'`, `'skipped'`) rendered by `StatusBadge`; refresh the snapshots
- [ ] Component tests:
  - [ ] Detail-view breakdown: given `runProgress = { passed: 3, failed: 2, blocked: 1, skipped: 0 }`, rendered chips read "Passed 3", "Failed 2", "Blocked 1", "Skipped 0"
  - [ ] Detail-view breakdown: given `runProgress` includes `no_run: 5`, a "No Run 5" chip appears with the correct color dot (or no dot, documented)
  - [ ] Filter dropdown: options are `["All Statuses", "Passed", "Failed", "Blocked", "Skipped", …]` — no lowercase labels
  - [ ] `StatusBadge`: `type="result" value="passed"` → rendered text "Passed"; `type="priority" value="high"` → rendered text "high" (unchanged)
- [ ] E2E: open `/test-runs/:id` for a seeded run; assert the breakdown shows Title-Case labels; open the status dropdown; assert every option is Title-Case; assert every result card chip reads Title-Case
- [ ] Dark-mode visual check: breakdown chips, dropdown options, and card chips render correctly in dark mode

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build` (TypeScript `Record<ResultStatus, string>` enforces map completeness)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/02-architecture/frontend/components.md` — document `src/utils/statusLabel.ts` as the canonical status-display helper; note that `StatusBadge` applies it internally for `type="result"`
- [ ] `docs/08-decisions/changelog.md` — record: status labels on `/test-runs/:id` (Test Progress, filter dropdown, result card chip) now render Title-Case via `statusLabel`; the `StatusBadge` change also Title-Cases every other result chip across the app (side-effect, intentional)
- [ ] `docs/04-execution/tech-debt.md` — add follow-ups: (a) Title-Case priority / run / type labels in `StatusBadge` via the same helper, (b) audit dashboard / list view / reports for any still-lowercase status rendering outside `StatusBadge`
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `RESULT_STATUS_LABELS` misses a union variant and TypeScript doesn't flag because the type is weaker than `Record<ResultStatus, string>` | Low | Explicit type annotation `Record<ResultStatus, string>` already enforces completeness at build; add a unit test iterating `RESULT_STATUSES` that asserts `statusLabel(s) !== s` for every variant |
| A status arrives from the backend that isn't in the frontend union yet (e.g. a new literal lands in API before a type regeneration) | Low | Fallback derivation produces a reasonable Title-Case label; no crash |
| Breakdown starts rendering more chips than the visual design accommodates (e.g. adds "No Run", "Retest") | Medium | Confirm the CSS of `.status-breakdown` wraps gracefully; smoke-test with 6 chips |
| Dropdown option order shifts when iteration switches from a literal object to `RESULT_STATUSES` | Low | Verify `RESULT_STATUSES` order matches the desired presentation order; reorder the constant if needed |
| Translating raw snake_case to Title-Case produces awkward labels (e.g. `retest` → `"Retest"` fine, but what about `in_progress`?) | Low | Preferred path is an explicit entry in `RESULT_STATUS_LABELS`; fallback is only for unplanned statuses |
| Bigger scope creep — someone fixes the execute page or dashboard in the same PR | Low | Plan scope is explicit; follow-ups logged; PR description lists the three sites |
| `StatusBadge` change silently breaks pages that relied on lowercase chip text (e.g. a Cypress selector asserting `:contains('passed')`) | Medium | Sweep tests repo-wide for literal lowercase status strings in `contains` / `toMatch` / snapshot assertions; update to Title-Case; PR description enumerates any touched test files |
| Rendered Title-Case label is longer than the old lowercase, wrapping a narrow chip | Low | Spot-check card layout at the smallest breakpoint; shortest label is "Failed" (6 → 6) and the only real length change is "no_run" (6 → 7 chars "No Run") — negligible |

---

## Definition of done

- [ ] On `/test-runs/:id`, the Test Progress breakdown displays Title-Case labels for every rendered status
- [ ] The status filter dropdown above the results list shows Title-Case option labels
- [ ] Every result card chip on the page shows a Title-Case status
- [ ] Filter values (the comparison strings) remain the raw lowercase status — filtering still works end-to-end
- [ ] `RESULT_STATUS_LABELS` is complete for the current `ResultStatus` union (TypeScript build enforces)
- [ ] `statusLabel` helper covers mapped lookup, snake_case → Title-Case fallback, and null handling
- [ ] `StatusBadge` applies `statusLabel` for `type="result"` only; other types are byte-for-byte unchanged
- [ ] Unit tests cover the helper and all three rendering sites (including `StatusBadge` regression for non-result types)
- [ ] E2E test verifies visible labels on the page
- [ ] Snapshots elsewhere in the repo that asserted lowercase result labels are refreshed
- [ ] Docs updated; follow-ups logged
- [ ] PR checklist completed
