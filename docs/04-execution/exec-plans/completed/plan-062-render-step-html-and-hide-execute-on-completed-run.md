# Execution Plan: Render step / description rich text as HTML on test-run pages, and hide "Execute Tests" on completed runs

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

Two small defects on test-run / test-case pages:

1. **Rich-text step content renders as a raw HTML string** on `/test-runs/:id/execute` (and anywhere on `/test-runs/:id` that shows steps) — users see `<p>Click login</p>` literally instead of a formatted paragraph. `/test-cases/:id` already renders it correctly. Make the two run pages render step/action/expected/description/preconditions the same way the case-detail page does, with the shared `.tiptap-content` styling.

2. **"Execute Tests" button on `/test-runs/:id` is always visible** even when the run's `status === "completed"`. A completed run is not meant to be executed again — the button lands on an execution view that will keep modifying results. Hide it for `completed` (and `aborted`) runs.

---

## Context

### Current step rendering

`/test-cases/:id` (`src/views/test-cases/TestCaseDetailView.vue:181-185`) already does it correctly:

```vue
<div class="tiptap-content" v-html="step.step"></div>
<div class="tiptap-content" v-html="step.expected"></div>
```

The `.tiptap-content` class (`src/assets/styles/main.css:1605+`) supplies the paragraph / heading / list / code styling the tiptap editor emits. Description + preconditions on the same page use the same pattern.

`/test-runs/:id/execute` (`src/views/test-runs/TestRunExecutionView.vue:741-745`) does **not**:

```vue
<div class="step-action">
  <strong>Action:</strong> {{ step.step }}         <!-- raw HTML printed as text -->
</div>
<div class="step-expected">
  <strong>Expected:</strong> {{ step.expected }}    <!-- same -->
</div>
```

A tiptap-produced step like `<p>Open login page</p><ul><li>Click "Login"</li></ul>` reads as an angle-bracket salad in the execution UI.

Description and preconditions on the execution page do render with `v-html` + `.tiptap-content` already (`TestRunExecutionView.vue:718, 726`) — the gap is only in the step list.

`/test-runs/:id` (`src/views/test-runs/TestRunDetailView.vue` + its right-hand `TestResultDetail` panel) does not currently render step content at all; but web plan 055's "not yet run" panel proposes showing case metadata including steps, and web plan 056's `<SuiteTreeRow>` may render expandable case previews. Once either lands, the same `v-html` + `.tiptap-content` treatment should apply there too — this plan covers the site(s) that exist today on that page and adds a short forward-compatible note for the others.

### Pre-existing XSS consideration

No DOMPurify (or equivalent) in the codebase. Existing `v-html` bindings trust the tiptap editor's output. Adding two more `v-html` bindings does **not widen the attack surface** beyond what `/test-cases/:id` already has — the same user writes the same HTML with the same editor. This plan notes the underlying concern and logs sanitisation as tech debt rather than rolling it into this change.

### "Execute Tests" button on a completed run

`TestRunDetailView.vue:157-164`:

```vue
<div v-if="authStore.canManageTests" class="header-actions">
  <Button
    data-testid="run-execute-btn"
    :label="showDetailPanel ? '' : 'Execute Tests'"
    icon="pi pi-play"
    :size="showDetailPanel ? 'small' : undefined"
    @click="router.push(`/test-runs/${testRunId}/execute`)"
  />
  <Button
    :label="showDetailPanel ? '' : 'Delete'"
    …
  />
</div>
```

Guarded only by role. A `completed` run is an immutable record of what happened; pushing "Execute Tests" then re-entering the execution view creates a mismatch between the run's advertised state and its mutation path. Hide the button for `completed` and `aborted` statuses; keep it for `planned` and `in_progress`.

The execution view itself (`/test-runs/:id/execute`) should probably refuse to mutate a completed run too, but that's a separate concern (server-side guard, if missing) — this plan only hides the surfacing button.

---

## Scope

### In scope

#### 1. Rich-text rendering

- `/test-runs/:id/execute` — `TestRunExecutionView.vue:741-746`:
  - Replace `{{ step.step }}` with `<div class="tiptap-content" v-html="step.step"></div>`
  - Replace `{{ step.expected }}` with `<div class="tiptap-content" v-html="step.expected"></div>`
  - Keep the `<strong>Action:</strong>` / `<strong>Expected:</strong>` prefix as a sibling label; move it above the rich-text block so the inline concatenation doesn't break the block-level tiptap elements (paragraphs/lists)
  - Confirm the surrounding `.step-action` / `.step-expected` CSS still positions the block correctly; no other style change needed
- `/test-runs/:id` — any step or description preview shown today on the page (audit `TestRunDetailView.vue` and `TestResultDetail.vue`):
  - If none exists, note this in the implementation (no change needed today); add a forward-compat comment near the first place that will render case content (per plan 055's "not yet run" panel) so the next contributor uses `.tiptap-content` + `v-html`
  - If any rich-text field is currently rendered with `{{ … }}`, swap to the tiptap pattern
- `/test-cases/:id` — already correct, **no code change**; included in scope only for the E2E sanity pass
- Consistency: the class is always `.tiptap-content`; reuse the existing stylesheet; do not introduce a new component unless an audit reveals 5+ duplicated sites (not the case today)

#### 2. Hide "Execute Tests" on completed / aborted runs

- `TestRunDetailView.vue`:
  - Compute `canExecuteRun = authStore.canManageTests && currentTestRun && !['completed', 'aborted'].includes(currentTestRun.status)`
  - Gate the Execute Tests `<Button>` with `v-if="canExecuteRun"` (keep the Delete button visible — delete semantics are unchanged)
  - Keep the `data-testid="run-execute-btn"` on the visible button so existing e2e tests still select it when the run is executable
- No change to `/test-runs/:id/execute` itself (direct navigation by URL remains possible for now — server-side guard is a follow-up)

### Out of scope

- Introducing DOMPurify (or equivalent) sanitisation of `v-html` — logged as tech debt; covers every current `v-html` site, not just the new ones
- A shared `<RichText>` component — two new call sites don't justify it; revisit if more appear
- Changing the execution view's behaviour for completed runs (redirect / read-only mode) — separate plan
- Rendering test-step content on the detail page beyond whatever is there today — plans 055 / 056 own the new panels; this plan only ensures the *existing* page is consistent
- Backend guards on mutating a completed run — follow-up API-side plan if absent
- Accessibility review of `v-html`-injected content — existing pattern on `/test-cases/:id`; not changing the risk profile

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-runs/TestRunExecutionView.vue` | Two `v-html` swaps in the steps list; lift the `<strong>` labels out of the same inline block |
| views | `src/views/test-runs/TestRunDetailView.vue` | `canExecuteRun` computed; `v-if` gate on the Execute Tests button; audit for any step/description rendering and convert if present |
| components | `src/components/test-runs/TestResultDetail.vue` | If step rendering is added per plan 055 during/after this plan, do it via `v-html` + `.tiptap-content`; otherwise no change |
| tests | `tests/unit/views/TestRunExecutionView.spec.ts` | Step with HTML content renders formatted (e.g. rendered node contains a `<p>` child rather than the literal string) |
| tests | `tests/unit/views/TestRunDetailView.spec.ts` | Execute button hidden for `completed`; visible for `planned` / `in_progress`; hidden for `aborted` |
| e2e | `tests/e2e/test-run-execute.spec.ts` | Seeded case with tiptap HTML steps renders formatted on the execution view |
| e2e | `tests/e2e/test-run-detail.spec.ts` | Seeded `completed` run has no Execute button; seeded `planned` run has one |

### Key decisions

- **Reuse `.tiptap-content`, don't make a new component.** Two new sites plus the existing three reach maybe five total; a shared `<RichText>` adds indirection without saving meaningful code. If the count grows past ~7, revisit.
- **Prefix labels live outside the `v-html` block.** `<strong>Action:</strong>` next to `{{ step.step }}` is fine inline — but once `step.step` emits block-level tags (paragraphs, lists), inlining produces broken layouts. Put the label on its own line above the rich-text div.
- **Status allow-list for the Execute button.** `!['completed', 'aborted'].includes(status)` is explicit and readable; prefer over `!== 'completed' && !== 'aborted'`. Future statuses default to *executable* — product can add to the list if needed.
- **Keep `canManageTests` role check.** The new computed wraps both the role check and the status check. Single source of truth for the button's visibility.
- **Don't touch the execution URL route guard.** The button is what typical users see; a direct URL visit to `/test-runs/:id/execute` for a completed run is an edge case. Server-side or route-level guard is a separate plan.
- **No XSS remediation here.** Introducing DOMPurify would silently change the rendering of existing `/test-cases/:id` content (e.g. stripping custom tags the editor uses). It's the right thing to do eventually; it deserves its own plan with a sanitisation allow-list review.

---

## Tasks

### Implementation

#### Rich text
- [ ] Audit the three target pages for every `{{ … }}` interpolation that renders a tiptap-authored field (`description`, `preconditions`, `step.step`, `step.expected`); list the sites
  - [ ] `/test-runs/:id/execute`: `TestRunExecutionView.vue:742, 745` confirmed as the only two
  - [ ] `/test-runs/:id`: confirm none today (expected); if `TestResultDetail.vue` shows any, add to the list
  - [ ] `/test-cases/:id`: confirm all four rich-text sites already use `v-html` + `.tiptap-content` (no change expected)
- [ ] `TestRunExecutionView.vue`:
  - [ ] Restructure the step item template so `<strong>Action:</strong>` and `<strong>Expected:</strong>` are on their own line
  - [ ] Render `step.step` and `step.expected` via `<div class="tiptap-content" v-html="…">`
  - [ ] Verify the `.step-item` layout still aligns numbers and content; tighten the vertical rhythm if the extra block introduces an awkward gap
- [ ] `TestRunDetailView.vue` audit — no step rendering exists today; add a short HTML comment near where plan 055's "not yet run" panel slots in, pointing future contributors at `.tiptap-content`

#### Completed-run button gate
- [ ] Add `const canExecuteRun = computed(() => authStore.canManageTests && testRunsStore.currentTestRun && !["completed", "aborted"].includes(testRunsStore.currentTestRun.status))`
- [ ] Replace the existing `v-if="authStore.canManageTests"` on the header-actions wrapper with a wrapper that still shows Delete but scopes the Execute button with its own `v-if="canExecuteRun"`:
  - [ ] Option A: keep the outer `v-if="authStore.canManageTests"` and add `v-if="canExecuteRun"` to the Execute Button only (cleaner)
  - [ ] Option B: split into two wrappers — only if Delete also needs a separate status gate later (not now)
- [ ] Preserve `data-testid="run-execute-btn"` on the Execute button for e2e stability

#### Tests
- [ ] Unit test `TestRunExecutionView`: mount with a case whose `steps[0].step = "<p>Click <strong>Login</strong></p>"`; assert the rendered DOM contains `<p>` with a `<strong>` child — not the literal string
- [ ] Unit test `TestRunDetailView`: parametrise run status; assert Execute button visible for `planned`/`in_progress`, hidden for `completed`/`aborted`; Delete button always visible when `canManageTests`
- [ ] E2E seed: a case with tiptap-authored step content (HTML) and a `completed` run for another case
  - [ ] `/test-runs/:id/execute`: step content shows with paragraph spacing, bold emphasis renders
  - [ ] `/test-runs/:id` of the completed run: Execute button absent; Delete present; of a `planned` run: both present
- [ ] Manual: dark-mode rendering of `.tiptap-content` inside the step list
- [ ] Manual: a case with empty `step.step` / `step.expected` renders nothing (not a literal "undefined" or "null")
- [ ] Manual: long list rendered in a step doesn't overflow the step card

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build` (vue-tsc)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — update the test-execution feature file (if present) to note that step content is rich text and renders with the tiptap stylesheet on both the detail and execution views
- [ ] `docs/02-architecture/frontend/components.md` — document that `.tiptap-content` is the canonical class for rendering tiptap-authored fields; new rich-text call sites should reuse it
- [ ] `docs/08-decisions/changelog.md` — record: (a) step content on the execution view now renders as HTML, matching case detail; (b) Execute button hidden for completed / aborted runs
- [ ] `docs/04-execution/tech-debt.md` — log follow-ups: (a) adopt DOMPurify for every `v-html` site; (b) server-side / route-level guard against mutating completed runs; (c) extract a `<RichText>` component if step / description rendering expands to many call sites
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A case with malicious HTML in its step content executes script on render | Low (same risk `/test-cases/:id` already carries) | No new surface vs existing pages; log DOMPurify adoption as tech debt and prioritise separately |
| `.tiptap-content` styles conflict with `.step-item` flex layout | Low | Visual check; `.tiptap-content` mostly styles block children — wrap in a constrained container if spacing drifts |
| An existing e2e test asserts literal `<p>…</p>` text appearing on the execution view | Low | Sweep tests for `toContain('<p>')` on that page; update to assert rendered DOM |
| Execute button hidden for a status we actually want to allow (e.g. a future `"paused"`) | Low | Allow-list of disabled statuses, not blocklist of enabled ones; new statuses default to executable |
| Users lose the ability to re-examine step content on a completed run because the execution view was their only way in | Low | The detail page already shows per-result step data; plans 055 / 056 expand this; the plan only hides the mutating entry point |
| Direct URL visit to `/test-runs/:id/execute` still allows mutations on a completed run | Medium | Out of scope; follow-up plan tightens the server guard (or a route-level `beforeEnter` guard) |
| Rendered `v-html` content overflows the step container on small screens | Low | `.tiptap-content` inherits the container width; verify on mobile breakpoint |

---

## Definition of done

- [ ] `/test-runs/:id/execute` renders each step's Action and Expected as formatted HTML (paragraphs, lists, emphasis, etc.), using `.tiptap-content`
- [ ] `/test-runs/:id` — any step or rich-text field that *is* rendered today uses the same pattern; a forward-compat comment marks the spot for future step rendering per plan 055
- [ ] `/test-cases/:id` visual parity confirmed unchanged (regression guard)
- [ ] `/test-runs/:id` hides the Execute Tests button when `run.status ∈ {completed, aborted}`
- [ ] Delete button visibility on `/test-runs/:id` is unchanged (still gated only on role)
- [ ] Unit tests cover rich-text rendering and status-based button visibility
- [ ] E2E tests cover a completed run (no button) and a run with HTML step content (formatted render)
- [ ] Dark-mode rendering verified for the execution step list
- [ ] Docs updated; follow-ups logged (DOMPurify, execution-route guard)
- [ ] PR checklist completed
