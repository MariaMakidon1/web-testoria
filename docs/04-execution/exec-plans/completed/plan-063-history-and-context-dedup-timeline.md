# Execution Plan: Deduplicate the "History & Context" timeline on `/test-runs/:id`

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

On the detail page's "History & Context" section (right-hand `TestResultDetail` → `TestResultHistoryPanel`), every change is shown **once**. Today the timeline always prepends the current `TestResult` as a synthetic event **and** then appends every row of `props.history`, which already contains a row for the current state — so the most-recent event appears twice (and, for legacy data produced before api plan 038, a single verdict re-submitted N times appears N+1 times).

---

## Context

The panel (`src/components/test-runs/TestResultHistoryPanel.vue:22-50`) builds its timeline like this:

```ts
const timelineEvents = computed<TimelineEvent[]>(() => {
  const events: TimelineEvent[] = [];

  // Add current result as most recent
  events.push({
    id: 0,
    status: props.result.status,
    user: props.result.tested_by ? `User #${props.result.tested_by}` : "Unknown",
    date: formatDate(props.result.tested_at),
    comment: props.result.comment,
    …
  });

  // Add history events
  props.history.forEach((h, index) => {
    events.push({
      id: h.id || index + 1,
      status: h.status,
      user: `User #${h.changed_by}`,
      date: formatDate(h.changed_at),
      comment: h.comment,
      …
    });
  });

  return events;
});
```

The server (`api-testoria: app/services/test_result_service.py:132`) records a `ResultHistory` row at `submit` time with the same `status` / `comment` / `tested_at` as the new `TestResult`. So `props.history` already contains an entry for what's on `props.result`. The frontend adding a synthetic "current" on top of that produces a duplicate.

Api plan 038 stops writing redundant rows on no-op resubmits. But:

- The current-state entry is **always** in history (creation and genuine changes both write one), so the synthetic-prepend pattern will keep producing one duplicate per result even after api plan 038 ships.
- Runs created before api plan 038 lands still have legacy duplicate rows (e.g. three identical entries from a user clicking "Passed" three times). The client must still render them without turning into a wall of copies.

So this plan handles both:

1. **Stop the synthetic prepend.** Drive the timeline purely from `props.history`; fall back to a single synthetic event only when `props.history` is empty (can happen if history fetch is pending / failed).
2. **Collapse legacy consecutive identical rows.** When two adjacent history rows share `(status, comment, changed_by)` within a short window, keep the first (the *real* first change) and drop the rest. Preserves auditability of meaningful changes without cluttering the timeline.

### Why not just drop the prepend and trust history?

If `props.history` hasn't loaded yet (fetch in flight, network error), the user would see an empty timeline even for a visible result. Prepending was a fallback for that — we keep the fallback but only when history is empty.

### "History & Context" is the same component used for the expandable panel

No separate component tree to consider. The fix lives in `TestResultHistoryPanel.vue` (and the parent's selector when a synthetic row is active per plan 055, whose `id === null` case still renders the "not yet run" panel instead of this history panel — no interaction).

---

## Scope

### In scope (component: `TestResultHistoryPanel.vue`, page: `/test-runs/:id`)

- Stop unconditionally prepending `props.result` to `timelineEvents`
- When `props.history.length > 0`: render `props.history` (sorted newest-first for display; backend returns `changed_at ASC`, so reverse in the computed)
- When `props.history.length === 0`: render a single synthetic event built from `props.result` as a loading / offline fallback
- Collapse consecutive identical rows: same `(status, comment, changed_by)`; the earliest row wins (that's the moment the state actually changed). Document the rule on the timeline tooltip (`"Repeated N times up to <latest date>"`) so the dedupe is visible, not hidden
- Don't collapse rows with different users (e.g. two testers toggled the same status — audit-relevant) or different comments
- Unit tests covering: typical case (no duplicate anymore), legacy duplicate (3 identical rows → 1 row with repeat indicator), empty history (fallback renders), differing users (no collapse)
- Visual: timeline ordering is newest-first (matches user mental model of "most recent at the top")
- No change to how the panel is invoked from `TestRunDetailView.vue`

### Out of scope

- Server-side deduplication of legacy rows (tracked in api plan 038's follow-up)
- Changing the `TestResultHistory` schema or backend response
- Exposing the per-step history breakdown
- Adding a "Show full history" toggle that un-collapses — logged as follow-up if users ask
- Replacing the PrimeVue `Timeline` with a custom component
- Historical diff viewer (before → after comments side-by-side)
- Changes to the execute-page history (plan 055/056 scope)
- User-name resolution (the `"User #X"` placeholder stays — covered by a different plan when the users store exposes display names for every referenced id)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/test-runs/TestResultHistoryPanel.vue` | Rewrite `timelineEvents`: primary source is `props.history`, reversed for newest-first; fallback to a one-item synthetic from `props.result` iff history is empty; collapse consecutive `(status, comment, changed_by)`-identical rows |
| types | none new | Reuse `TestResult`, `TestResultHistory` |
| tests | `tests/unit/components/TestResultHistoryPanel.spec.ts` | All cases described below |
| e2e | `tests/e2e/test-run-detail.spec.ts` | Seeded: submit twice → timeline shows one entry |

### Key decisions

- **`props.history` is the source of truth.** It's the backend's append-only log. The client should display it, not re-construct from the transient `props.result`.
- **Keep a fallback path.** Empty history (pre-fetch, fetch error) shouldn't show nothing; display the current result as a single event, clearly labelled.
- **Consecutive-identical collapse, not arbitrary dedupe.** A collapse that reorders or merges non-adjacent events would hide real state transitions (A → B → A is three real events, not two). Only adjacent identical rows are redundant.
- **User-id in the identity tuple.** Two testers recording the same verdict on the same result is an audit-relevant pair, even if the status / comment match. Don't collapse those.
- **Visible repeat indicator.** Dropping rows silently is confusing if an auditor remembers clicking six times. Showing "Set to Passed (×3)" preserves the information while cleaning the visual.
- **Newest-first ordering.** The backend returns `changed_at ASC` (oldest first); the UI displays top-down newest-first. Reverse in the computed, not in the fetcher.
- **No behaviour change for synthetic `no_run` rows** (per plan 055): those results have `id === null` and never reach this panel; `TestRunDetailView.vue` selects the "not yet run" view instead.
- **Dedup lives in the render layer** because the backend history table may still contain legacy rows; after api plan 038 ships, new data won't need collapsing, but old data will.

---

## Tasks

### Implementation
- [ ] Rewrite `timelineEvents` in `TestResultHistoryPanel.vue`:
  - [ ] Base case: `if (props.history.length === 0) → single synthetic event from props.result, clearly treated as "current state (no history loaded)"`
  - [ ] Else: map `props.history` → `TimelineEvent[]`
  - [ ] Reverse the array (newest first)
  - [ ] Collapse adjacent events with identical `(status, comment ?? null, changed_by)` tuple; aggregate the repeat count and the latest timestamp
- [ ] Update the timeline event type / tooltip to show repeat count when > 1 (e.g. `label: "Passed" + (repeated > 1 ? ` (×${repeated})` : "")`)
- [ ] Unit tests:
  - [ ] Typical (post–plan 038) result with one history row → timeline shows exactly one event, no duplicate
  - [ ] Legacy (pre–plan 038) 3 identical rows → one event with `×3`
  - [ ] A, A, B, A (three status transitions) → three events: `A` (×2), `B`, `A`
  - [ ] Two rows same status but different `changed_by` → two events
  - [ ] Two rows same status but different `comment` → two events
  - [ ] Empty history → single fallback event from `props.result`
  - [ ] Newest-first ordering preserved
- [ ] E2E:
  - [ ] Seed: a case, a result with two identical submits against a backend that still writes redundant rows
  - [ ] Open `/test-runs/:id`; select that case; assert the timeline shows 1 event with the repeat indicator
  - [ ] Change the status; re-open the panel; assert 2 events, newest on top
- [ ] Manual: dark-mode rendering of the timeline; long comments wrap cleanly; repeat indicator badge readable

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build`
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — if a feature file describes the history panel, update to describe the collapse rule
- [ ] `docs/02-architecture/frontend/components.md` — document `TestResultHistoryPanel` as the single history surface; render-layer dedupe rule; newest-first ordering
- [ ] `docs/08-decisions/changelog.md` — record: timeline no longer prepends the current result; adjacent identical history rows collapse with a repeat indicator; newest-first ordering
- [ ] `docs/04-execution/tech-debt.md` — log follow-ups: (a) show the "full, uncollapsed" history via a toggle if users ask, (b) user-name resolution in history (instead of `User #N`)
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Users miss a legitimate repeated action because it's collapsed | Low | Repeat indicator (`×N`) + tooltip with the earliest and latest timestamps; follow-up "show full" toggle logged |
| Backend history is empty transiently (fetch in flight) and the fallback synthesises a misleading "current" event | Low | The fallback is clearly labelled "current state"; disappears once history arrives; same UX as today |
| Two consecutive rows same status/comment but seconds apart from *different* testers → currently shown as two events; any future widening of the identity tuple would hide | Low | Identity tuple includes `changed_by`; documented; unit-tested |
| PrimeVue `Timeline` re-orders the array unexpectedly based on its own date parsing | Low | Pass a pre-ordered array; avoid relying on Timeline's internal sort |
| Legacy data with millions of duplicate rows is slow to collapse on the client | Low | Collapse is O(n) over the result's history, typically < 50 rows; server returns bounded history anyway |
| `props.history` shape drift (e.g. `comment` becomes required) | Low | Type imports ensure build fails if the type changes incompatibly |
| Repeat indicator text collides with status label on a very narrow timeline column | Low | Visual check in both themes; truncate / wrap as needed |

---

## Definition of done

- [ ] Selecting a result with one post-change history row shows **one** timeline event (no duplicate with the "current" prepend)
- [ ] Selecting a result with legacy identical history rows shows one event per state transition, with a `×N` repeat indicator where applicable
- [ ] Selecting a result whose `props.history` is empty still renders a single fallback event built from `props.result`
- [ ] Distinct transitions (status change, comment change, different tester) remain separate events
- [ ] Timeline ordered newest-first
- [ ] Unit tests cover the collapse rule, fallback, and ordering
- [ ] E2E verifies a seeded "duplicate submit" scenario renders a deduplicated timeline
- [ ] Dark mode verified
- [ ] Docs updated; follow-ups logged
- [ ] PR checklist completed
