# Execution Plan: Unify Priority Tag Colors Across List and Detail Views (TES-81)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Render every Priority tag through a single visual primitive — the PrimeVue `<Tag :severity>` driven by `getPrioritySeverity(...)` — so that "Medium" looks the same on the test-case list as it does on the test-case detail view, the editor, the run-create wizard, and the run-execute view. Today the list view paints a custom hex badge keyed to a separate `PRIORITY_COLORS` map; "medium" comes out yellow there and blue (`info` severity) everywhere else.

Linear: [TES-81](https://linear.app/testoria/issue/TES-81/priority-tag-colors-are-inconsistent-between-test-case-list-and-test) — Bug, Low. Parent: TES-68.

---

## Context

In `src/types/testCase.ts` two parallel definitions of "priority colour" live side by side:

- `getPrioritySeverity(priority)` → `"danger" | "warning" | "info" | "success"` — the PrimeVue Tag severity, theme-driven, used by every Tag in the app: `TestCaseDetailView.vue:113`, `TestCaseEditorView.vue:295`, `TestRunCreateView.vue:486`, `TestRunExecutionView.vue:831`, `TestSuiteTreeSelector.vue:155`.
- `PRIORITY_COLORS` → a `Record<Priority, string>` of hex codes (`critical: #dc2626, high: #f97316, medium: #eab308, low: #22c55e`).

The only consumer of `PRIORITY_COLORS` today is `TestCaseSection.vue:5` and its local `getPriorityColor(priority)` (`TestCaseSection.vue:87`), which renders the priority as a custom `.priority-badge` span with `background-color` set from the hex map. The lowercase label is shown verbatim (e.g. `"medium"`) — every other surface routes through `PRIORITY_LABELS` to render the Title-cased `"Medium"`.

Two visible inconsistencies follow:
1. **Hue mismatch on `medium`.** PrimeVue's `info` severity is blue; `PRIORITY_COLORS.medium` is yellow (`#eab308`). The same case looks blue on the detail page and yellow in the list.
2. **Case mismatch on the label.** List shows the raw enum value (`"medium"`); every other surface shows `PRIORITY_LABELS["medium"] === "Medium"`.

Both are fixed by swapping the custom badge for a PrimeVue `<Tag :severity="getPrioritySeverity(...)" :value="PRIORITY_LABELS[...]">`, matching the established pattern. `PRIORITY_COLORS` then has zero call-sites in `src/` and can be removed; the PDF exporter (`usePdfExport.ts:67`) carries its own RGB map for jsPDF, which is a separate medium and stays untouched — it remains as the existing "Status color duplication across four sources (plan-048)" tech-debt item.

---

## Scope

### In scope

- Replace the `.priority-badge` `<span>` in `TestCaseSection.vue` with a PrimeVue `<Tag :value="PRIORITY_LABELS[priority]" :severity="getPrioritySeverity(priority)">`.
- Drop the local `getPriorityColor` function and the `PRIORITY_COLORS` import in `TestCaseSection.vue`.
- Drop the `.priority-badge` CSS (component-scoped — no other consumer).
- Remove the `PRIORITY_COLORS` export from `src/types/testCase.ts` — no remaining consumers in the codebase after the swap.
- Visual regression check: open the list view, confirm Medium is blue (matching detail). Critical stays red, High orange, Low green. Labels are Title case across all surfaces.

### Out of scope

- The PDF exporter's separate RGB priority map (`usePdfExport.ts`). Different output medium; the existing tech-debt entry "Status color duplication across four sources (plan-048)" already covers consolidating PDF / Excel / CSS-var / TS-constant colour definitions into a single source.
- Switching PrimeVue's `info` severity to a different theme colour. PrimeVue theme drives the chosen blue; if the user prefers another hue for Medium, that's a theme-level decision (separate plan).
- Migrating other usages of `PRIORITY_LABELS` or `getPrioritySeverity` — they're already consistent with the target pattern.
- Backend changes — none.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/test-cases/TestCaseSection.vue` | Swap `<span class="priority-badge">` for `<Tag>`; drop `getPriorityColor` + `PRIORITY_COLORS` import; drop `.priority-badge` CSS |
| types | `src/types/testCase.ts` | Remove the now-unused `PRIORITY_COLORS` export |
| docs | `docs/01-product/features/003-test-case-authoring.md` | Note that priority chips render through `<Tag :severity>` everywhere |

### Key decisions

- **Use the existing severity helper, not a new constant.** Every other view already maps priority → PrimeVue severity through `getPrioritySeverity`. Promoting the list view to the same helper makes the existing pattern the single source of truth.
- **Drop `PRIORITY_COLORS` rather than keep it for "future use".** No remaining consumer; YAGNI. A hex map for non-PrimeVue surfaces (e.g. CSS-var or a future canvas chart) can be reintroduced when an actual consumer needs it, ideally as part of consolidating the four-source colour duplication tech-debt item.
- **Pass `PRIORITY_LABELS[priority]` as the Tag value.** Matches `TestRunCreateView.vue` and `TestRunExecutionView.vue`. The previous `{{ testCase.priority }}` rendered the raw enum (`"medium"`) in lowercase, which already looked inconsistent next to the Title-cased detail-view label.
- **Keep `.priority-badge` removal scoped to the section component.** The class wasn't shared (component-scoped style); no global stylesheet references it.

---

## Tasks

### Implementation
- [x] `src/components/test-cases/TestCaseSection.vue`: import `Tag`, `PRIORITY_LABELS`, `getPrioritySeverity`; swap the `<span class="priority-badge">` for `<Tag :value :severity>`; remove `getPriorityColor` and `PRIORITY_COLORS` import; drop the `.priority-badge` CSS block
- [x] `src/types/testCase.ts`: remove the `PRIORITY_COLORS` export
- [x] Spot-check in dev that Medium renders the same in list and detail

### Tests
- [x] Unit/e2e — no new test required (visual change to existing rendering covered implicitly by build + lint). If a future regression matters, the snapshot tests under `tests/unit/components` would be the place to add coverage; deferred.

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/003-test-case-authoring.md` — note unified Tag rendering
- [x] `docs/08-decisions/changelog.md` — plan-095 entry
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Removing `PRIORITY_COLORS` breaks a consumer I missed | Very low | `grep -r PRIORITY_COLORS src/` returns only `TestCaseSection.vue` (now swapped) and the export itself. `npm run build` (vue-tsc strict) would catch any stray import |
| Theme-driven `info` blue clashes with the design intent of "Medium = yellow" | Low | The intent across every other view (and the existing PRIORITY_LABELS / severity mapping in the type module) was already `info` for medium. The list was the outlier, not the standard — confirmed by the bug report's "Expected: identical across all views" wording |

---

## Definition of done

- [x] Priority Medium renders identical hues on the test-case list and the detail view
- [x] Priority labels render in Title case ("Medium", "High", etc.) across the list view, matching every other surface
- [x] `PRIORITY_COLORS` has zero references in `src/` (PDF exporter map is separate and untouched)
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Feature doc + changelog updated
- [x] TES-81 marked Done in Linear with the merge commit linked
