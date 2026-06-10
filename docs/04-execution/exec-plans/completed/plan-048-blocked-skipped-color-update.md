# Execution Plan: Recolor Blocked → Dark Gray, Skipped → Light Gray

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Update every place in the web-testoria codebase where the `blocked` and `skipped` result statuses are colored so that **Blocked reads as dark gray** and **Skipped reads as light gray**, everywhere — buttons, badges, chips, progress bar segments, exports (PDF/Excel), and theme variables — without drifting values across the duplicated sources.

---

## Context

Today the status colors are not aligned with the rest of the test-run UX work (`plan-104-test-run-segmented-progress-bar.md`, `plan-105-execution-per-step-status.md`) that explicitly reuses these tokens for the segmented progress bar and the per-step picker. The current values are:

- `--status-blocked: #f59e0b` — **amber** (`src/assets/styles/variables.css:48`). Semantically wrong: "blocked" is not a warning, it's a halt state; visually it collides with priority=high in the priority palette.
- `--status-skipped: #6b7280` — **medium gray** (`src/assets/styles/variables.css:49`). Already gray but too dark; indistinguishable from blocked once blocked also becomes gray.

The colors are defined in two canonical places and then duplicated across two exporters:

1. **CSS variables**: `src/assets/styles/variables.css:45–51`
2. **TS constants**: `src/types/testResult.ts:64–69` (`RESULT_STATUS_COLORS`)
3. **PDF export RGB map**: `src/composables/usePdfExport.ts:47` (jsPDF needs `[r, g, b]` tuples)
4. **Excel export hex map**: `src/composables/useExcelExport.ts:32` (ExcelJS needs ARGB hex strings without `#`)

Downstream consumers (all already wired to one of the two canonical sources — no hardcoded colors in view files):
- `src/views/test-runs/TestRunDetailView.vue:247–248`
- `src/views/test-runs/TestRunExecutionView.vue:94`
- `src/components/test-runs/TestResultsList.vue:133`
- `src/components/test-runs/TestResultCard.vue:54–55, 75`
- `src/components/test-runs/TestResultHistoryPanel.vue:34, 45`
- `src/components/common/StatusBadge.vue` (reads `--status-*` CSS vars)
- `src/views/dashboard/DashboardView.vue` (status widgets)

So the change surface is **2 canonical definitions + 2 export maps** plus a visual sweep of the consumers. This plan is small, cross-cutting, and low-risk — provided all four sources are updated in lockstep.

---

## Scope

### In scope
- Change `--status-blocked` and `--status-skipped` in `variables.css`
- Change `RESULT_STATUS_COLORS.blocked` and `.skipped` in `src/types/testResult.ts`
- Change the `blocked` / `skipped` entries in the PDF export RGB map (`usePdfExport.ts:47`)
- Change the `blocked` / `skipped` entries in the Excel export hex map (`useExcelExport.ts:32`)
- Visual review of every downstream consumer listed above, in both light and dark theme
- Verify text-on-color contrast remains ≥ WCAG AA for any place the color is used as a background with text on top (badges, chips, progress segments)
- Update `plan-104` and `plan-105` cross-references if they pinned specific hex values (they intentionally reference tokens, so no edit should be needed — verify)
- Dark-mode override check: if `variables.css` has a `.dark-mode` block, update the dark-mode values too

### Out of scope
- Recoloring other statuses (`passed`, `failed`, `retest`, `untested`) — only blocked and skipped
- Changing priority colors
- Redesigning `StatusBadge.vue` structure — only the color values it reads
- Introducing a new color token for "blocked-bg" vs "blocked-text" — the existing single-token model is kept
- Backend changes of any kind

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| tokens | `src/assets/styles/variables.css` | `--status-blocked` → dark gray; `--status-skipped` → light gray; apply the same change inside any dark-mode block present in the file |
| tokens | `src/types/testResult.ts` | `RESULT_STATUS_COLORS.blocked` and `.skipped` updated to match the CSS values exactly |
| exports | `src/composables/usePdfExport.ts` | `statusColors.blocked` and `.skipped` RGB tuples updated to match |
| exports | `src/composables/useExcelExport.ts` | `statusColors.blocked` and `.skipped` ARGB strings updated to match (drop the `#`, add `FF` alpha prefix) |
| verify | All 8 consumer files listed above | Visual-only check — no code edits unless a consumer hardcodes a color instead of reading the token (none found during investigation, confirm during execution) |

### Key decisions

- **Recommended values** (proposed, subject to a quick visual review before locking in):
  - **Blocked = `#4b5563`** (Tailwind gray-600). Dark enough to read as "stopped / halted" without becoming pure black; contrasts well against both light surface and dark surface. White text on top passes AA.
  - **Skipped = `#9ca3af`** (Tailwind gray-400). Clearly lighter than blocked, reads as "neutral / deferred". Dark text on top passes AA; white text does not. `StatusBadge` uses dark text on light backgrounds already — verify during the sweep.
- **Single token per status, not a pair**: the current model is one CSS var per status, used as both background (badges, chips) and foreground (icons, borders). Splitting into `-bg` and `-text` variants is a larger refactor and out of scope. The picked values support both uses adequately.
- **Keep CSS and TS values byte-identical**: duplication is unavoidable given jsPDF and ExcelJS need their own formats, but all four sources must hold the same logical color. Enforce via a review checklist in this plan's execution step. Long-term, extracting a single `status-colors.ts` module that exports both hex and RGB would eliminate the TS/export drift — logged as tech debt, not done here.
- **Dark-mode parity**: if `variables.css` has a `.dark-mode` override, update both light and dark values, even if the chosen grays happen to read fine on both. Explicit is better than implicit.
- **WCAG AA, not AAA**: aiming for AA (4.5:1 contrast for small text, 3:1 for large text / graphical). AAA is nice-to-have but the existing palette does not meet it either.
- **No visual regression in the segmented progress bar** from plan 104: that plan already reuses `--status-blocked` and `--status-skipped` tokens. Once this plan lands, the bar re-renders with the new colors automatically — no plan-104 edit required. Confirm by opening the bar on a run that has some blocked/skipped cases.

---

## Tasks

### Implementation
- [x] Confirm final hex values for Blocked and Skipped (recommended `#4b5563` and `#9ca3af`); quick visual sanity check on a dev build before committing
- [x] Update `--status-blocked` and `--status-skipped` in `src/assets/styles/variables.css` (including any dark-mode block)
- [x] Update `RESULT_STATUS_COLORS.blocked` and `.skipped` in `src/types/testResult.ts` to match exactly
- [x] Update `statusColors.blocked` and `.skipped` in `src/composables/usePdfExport.ts` (RGB tuple form)
- [x] Update `statusColors.blocked` and `.skipped` in `src/composables/useExcelExport.ts` (ARGB hex string form, no `#`, `FF` alpha prefix)
- [x] Repo-wide grep for any hardcoded `#f59e0b` or `#6b7280` literals outside the four canonical files; if any exist, either replace with the token or document why
- [x] Visual sweep against a seeded dev DB with a run containing blocked and skipped results:
  - [x] `StatusBadge` on list and detail pages
  - [x] `TestResultsList` color swatches
  - [x] `TestResultCard` status badge
  - [x] `TestResultHistoryPanel` history entries
  - [x] `TestRunDetailView` progress section and breakdown row
  - [x] `TestRunExecutionView` header summary + step picker (plan 105, if merged)
  - [x] Segmented progress bar (plan 104, if merged)
  - [x] `DashboardView` status widgets
  - [x] `KeyboardShortcutsDialog` (if it lists status shortcuts with colors)
- [x] Dark-mode sweep of the same list
- [x] PDF export smoke test — export a run with blocked + skipped results, open the PDF, confirm the new colors
- [x] Excel export smoke test — export the same run, open the workbook, confirm cell fill colors
- [x] WCAG AA contrast check (use any browser devtool or a quick script) for:
  - white text on `--status-blocked`
  - dark text on `--status-skipped`

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes (no tests should break — colors are not asserted in existing tests)
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/07-references/llm/design-system.txt` — update the status-color section with the new values and the dark-gray/light-gray intent
- [x] `docs/08-decisions/changelog.md` — record: moved blocked off amber (semantic conflict with priority=high), picked specific gray values, acknowledged the four-source duplication as tech debt
- [x] `docs/04-execution/tech-debt.md` — log "extract a single `status-colors.ts` module exporting hex+RGB+ARGB to eliminate drift across PDF/Excel/CSS/TS duplication" as a follow-up
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map / api-schema / feature doc update — no routes, no API, no feature surface change.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| One of the four sources is missed and the UI drifts (PDF shows old amber, UI shows new gray) | Medium | Execution checklist enumerates all four; smoke tests for PDF and Excel exports catch any miss |
| Dark mode becomes hard to read because both grays merge into the dark surface | Medium | Dark-mode sweep on every consumer; if needed, override the token inside the dark-mode block with slightly shifted values |
| `StatusBadge` uses white text on all statuses, and `#9ca3af` under white drops below AA (3.4:1) | Medium | During the sweep, check the badge's text color; if it's white everywhere, switch the skipped variant to dark text or lighten the background only for that component |
| A downstream consumer hardcodes `#f59e0b` or `#6b7280` instead of reading the token | Low | Repo-wide grep step catches this before merge |
| Users have muscle memory associating "amber = blocked" and get confused | Low | One-time change; note it in the next release note / changelog entry |
| Plans 104 / 105 ship with a specific color hex hardcoded somewhere and drift from the new token | Low | Both plans explicitly say "use theme tokens, not hardcoded hex" — verify during their own reviews; this plan does not edit them |

---

## Definition of done

- [x] All four canonical sources (CSS var, TS constant, PDF map, Excel map) hold the new Blocked and Skipped values and they are byte-consistent
- [x] Every consumer listed in the sweep renders the new colors in both light and dark mode
- [x] White-text-on-blocked and dark-text-on-skipped both meet WCAG AA
- [x] PDF and Excel exports render the new colors
- [x] No hardcoded `#f59e0b` or `#6b7280` literals remain outside the four canonical files
- [x] Tech debt logged for the single-source refactor
- [x] PR checklist completed
- [x] Docs updated
