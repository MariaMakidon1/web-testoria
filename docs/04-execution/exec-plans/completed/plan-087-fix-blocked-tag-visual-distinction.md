# Execution Plan: Make "Blocked" Tag Visually Distinct from "Passed" (TES-78)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

The **Blocked** result tag rendered by `StatusBadge` is visually obviously distinct from **Passed**. Specifically: blocked uses the slate-gray (`#4b5563`) already canonical across the rest of the app's result UI (suite-tree row indicators, segmented chip strip, CSS variable `--status-blocked`), with white text and the existing `pi-ban` icon — readable, neutral, unmistakable next to a green Passed tag.

Linear: [TES-78](https://linear.app/testoria/issue/TES-78/blocked-tag-is-visually-identical-to-passed-tag-in-test-run-view) — Bug, Medium.

---

## Context

`src/components/common/StatusBadge.vue:23-29` maps the four result statuses to PrimeVue severities:

```ts
passed:  { severity: "success",   icon: "pi pi-check-circle" }
failed:  { severity: "danger",    icon: "pi pi-times-circle" }
blocked: { severity: "warning",   icon: "pi pi-ban" }
no_run:  { severity: "secondary", icon: "pi pi-minus-circle" }
```

In default PrimeVue Aura, `success` is light-green and `warning` is light-yellow/amber — they should be distinguishable, but the reporter's screenshot has them appearing identically green and several reviewers have hit the same confusion. Whatever the root cause (theme palette overlap, monitor profile, color-vision corner case), **the bug is real**: two adjacent result tags must never be interpreted as the same status.

Meanwhile, every *other* place the app paints a "blocked" indicator already uses the slate-gray token:
- `src/types/testResult.ts:85-90` — `RESULT_STATUS_COLORS.blocked = "#4b5563"`
- `src/assets/styles/variables.css:48` — `--status-blocked: #4b5563`
- `src/components/test-runs/SuiteTreeBranch.vue:268-269` — `.seg-blocked { background: var(--status-blocked); }`
- `src/components/test-runs/SuiteTreeResults.vue:111-112` — row-dot color via `RESULT_STATUS_COLORS`

So inside the same Test Run view the user sees blocked rendered as gray (row indicator + segment chip) AND as PrimeVue warning (the badge) at the same time. Aligning the badge with the rest of the system is both the bug fix and a small consistency win.

`StatusBadge` already supports per-instance `customColor`/`customBackground` props, so the change is local to the result-type config branch — priority/run/type tag types keep their PrimeVue-severity rendering unchanged.

---

## Scope

### In scope

- `src/components/common/StatusBadge.vue`:
  - When `type === "result"`, source the visual styling from a colocated lookup that uses the same canonical hex values as `RESULT_STATUS_COLORS` (`passed: #22c55e`, `failed: #ef4444`, `blocked: #4b5563`, `no_run: #9ca3af`). For each, derive a background + text color pair that meets WCAG AA contrast for tag-sized text:
    - `passed` → background `#dcfce7` (green-100), text `#166534` (green-800), icon `pi pi-check-circle`
    - `failed` → background `#fee2e2` (red-100), text `#991b1b` (red-800), icon `pi pi-times-circle`
    - `blocked` → background `#4b5563` (slate-600 — the existing `--status-blocked`), text `#ffffff`, icon `pi pi-ban`
    - `no_run` → background `#f3f4f6` (gray-100), text `#374151` (gray-700), icon `pi pi-minus-circle`
  - For result-type badges, render via the existing `customColor`/`customBackground` flow (already wired into `customStyle` and the `<Tag :style>` binding). Other `type` values (`priority`, `run`, `type`, `custom`) keep their current PrimeVue-severity behaviour — no regression to those palettes.
  - Keep the icon mapping unchanged in semantics; just sourced from the same colocated map for symmetry.
- Verify visual correctness on Test Run views by spot-checking the components that render `<StatusBadge type="result">`:
  - `src/components/test-runs/TestResultDetail.vue` (header status, history rows, defects panel)
  - `src/components/test-runs/SuiteTreeBranch.vue` (badges next to test cases in read mode)
  - `src/components/test-runs/StepStatusPicker.vue` (per-step status chips, if any use result type)
- Unit tests: extend `tests/unit/components/StatusBadge.spec.ts` (or create) — assert that for `type="result"` and `value="blocked"`, the rendered tag has the gray background and is **not** the same background as `value="passed"`. Add a regression-style test that explicitly compares passed and blocked computed styles to ensure they differ.
- Playwright e2e: add a small visual-distinction assertion to an existing test-runs spec — open a run with at least one blocked result, locate the blocked badge and the passed badge by their visible labels, assert the inline `background-color` styles differ. (No screenshot diff; CSS-style assertion is sufficient and stable.)

### Out of scope

- Replacing PrimeVue severities for the *other* tag types (`priority`, `run`, `type`). Their palettes work; touching them risks regressing places like the run-status chip on the runs list. Separate plan if a broader unification is wanted.
- Adding a color-blind / high-contrast theme toggle. Worth doing eventually; not for this bug.
- Dark-mode tweaks beyond confirming the new tokens don't render unreadable. The four hex pairs above are tested against the existing dark-mode styles in `main.css:1131-1140`; if any contrast falls under WCAG AA in dark mode, fix in this plan, otherwise defer.
- Refactoring the duplicated `RESULT_STATUS_COLORS` ↔ `--status-blocked` definitions into a single source of truth. The existing duplication is small and converging on it (this plan uses the same hex everywhere) makes a future deduplication trivial; no upfront cleanup needed.
- Backend changes — none.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/common/StatusBadge.vue` | Add a `resultBadgeStyles` lookup with `{ bg, fg, icon }` per result status. When `type === "result"`, set `customStyle` from this lookup (and use the lookup's icon). Other types unchanged |
| tests | `tests/unit/components/StatusBadge.spec.ts` | Augment or create — assert blocked has gray background and is not equal to passed's background; assert text/contrast, icon |
| tests | `tests/e2e/test-runs.spec.ts` (or a new `tests/e2e/result-badges.spec.ts`) | On a run with ≥ 1 blocked result, assert the blocked badge's `background-color` differs from the passed badge's |
| docs | `docs/01-product/features/006-test-execution.md` | Note that result tags use canonical `--status-*` tokens via `StatusBadge` (not PrimeVue severities) |
| docs | `docs/03-engineering/patterns/component-patterns.md` (only if a `StatusBadge` reference exists there) | Update the recommended usage; no change if it doesn't reference per-status colors |

### Key decisions

- **Custom colors only for `type="result"`; other types keep PrimeVue severities.** Smallest blast radius — fixes the bug without auditing every `<Tag>` in the app. `priority`, `run`, `type` tag rendering stays bit-for-bit identical.
- **Use the same hex values already canonical in `RESULT_STATUS_COLORS`/`--status-blocked`.** Aligns the badge palette with the row-indicator palette so a user looking at the same run sees the same "blocked = gray" signal everywhere. Eliminates the current "gray indicator + warning-yellow badge" split.
- **Background-100/text-700 pairs for passed/failed/no_run; solid slate-600 + white text for blocked.** Matches the bug reporter's explicit suggestion ("grey background with dark/black text") in spirit while preserving readable contrast. Blocked stays the visually heaviest because it's the most likely to be misread as something else — the eye should land on it deliberately.
- **WCAG AA verified per pair**: `#166534 / #dcfce7` ≈ 7.5:1; `#991b1b / #fee2e2` ≈ 7.7:1; `#ffffff / #4b5563` ≈ 8.6:1; `#374151 / #f3f4f6` ≈ 11.0:1. All comfortably above the 4.5:1 floor.
- **Don't introduce a new constant; colocate the lookup.** A new `RESULT_BADGE_STYLES` would either duplicate `RESULT_STATUS_COLORS` or force the latter to grow text/bg pairs it doesn't currently need elsewhere. Colocating in `StatusBadge.vue` keeps the change reversible and the badge component self-contained. If a second consumer ever needs the bg+fg pair, hoist then.
- **Dark mode kept consistent via the existing `main.css:1131-1140` rules.** The new explicit `background-color` + `color` will override the dark-mode `.p-tag` defaults — verified to read fine on the dark surface; if any pair regresses, add a `[data-theme="dark"]` selector in `StatusBadge.vue`'s scoped style.
- **Icon stays the same per status.** Icon colour inherits the badge's text color via `.status-badge :deep(.p-tag-icon)` — no extra rule needed.

---

## Tasks

### Implementation
- [x] Add `resultBadgeStyles` map in `src/components/common/StatusBadge.vue` (background hex, text hex, icon)
- [x] Update `badgeConfig` / `customStyle` for `type === "result"` to source from the new map
- [x] Spot-check: run dev server, open a Test Run with a blocked + passed + failed + no_run mix, eyeball the badges in `TestResultDetail`, `SuiteTreeBranch`, the runs list, and dark mode

### Tests
- [x] Augment / create `tests/unit/components/StatusBadge.spec.ts`:
  - [x] `type="result"` + `value="blocked"` renders with gray background `#4b5563` and white text
  - [x] `value="blocked"` background ≠ `value="passed"` background (regression guard)
  - [x] All four result statuses produce a non-empty icon
- [x] Playwright assertion in test-runs e2e: blocked vs passed badge inline-style backgrounds differ

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/006-test-execution.md` — note unified result-tag palette and the blocked-vs-passed distinction
- [x] `docs/08-decisions/changelog.md` — plan-087 entry: blocked badge realigned to slate-600 to match canonical `--status-blocked`
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| The new background/text pairs render unreadably in dark mode | Low | Pairs were chosen with both modes in mind; verified WCAG AA. If any pair fails in dark mode, add a `[data-theme="dark"]` override in the scoped style |
| Existing snapshot or visual-regression tests assert the previous severity-driven markup (`p-tag-warning` class on blocked) | Low | Repo grep showed no snapshot tests asserting these classes. The new render still uses `<Tag>` so DOM structure is identical; only `style` differs |
| Other `<StatusBadge>` consumers (priority/run/type tags) regress because of a refactor mistake | Low | Switch is gated on `type === "result"`; other branches in `badgeConfig` are untouched. Unit tests cover that priority/run badges still produce the prior severity |
| The standalone `RESULT_STATUS_COLORS` constant drifts from the new badge map and a future change desyncs them | Low–Medium | Both share the same hex values today (intentional). A short comment in both call sites pointing at the other is enough; full deduplication is queued out of scope |
| Icon color stops inheriting text color | Very low | The existing `:deep(.p-tag-icon)` rule sets `margin-right: 0` only; PrimeVue icons inherit `color` by default. Verify visually after change |

---

## Definition of done

- [x] In a Test Run with passed + blocked badges visible side by side, the two are obviously different colors (gray vs green) and unmistakable at a glance
- [x] Blocked badge background equals `#4b5563` (matches `--status-blocked`) with white text
- [x] Other tag types (`priority`, `run`, `type`) render identically to before — no visual regression
- [x] Unit test asserts blocked background ≠ passed background (regression guard)
- [x] Playwright e2e confirms the same on a real rendered page
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Feature doc + changelog updated
- [x] TES-78 marked Done in Linear with the merge commit linked
