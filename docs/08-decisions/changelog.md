# DECISION CHANGELOG

Record of significant architectural and design decisions.
For formal ADRs, see `docs/02-architecture/decisions/`.

---

## 2026-06-03 — Plan-098: Invite-only user creation, opened to Lead + Admin

### What
- Opened user management to **Lead and Admin**: lowered `/users` and `/users/:id`
  to `minRole: "lead"` and added a `canManageUsers` flag (`hasMinRole("lead")`) to
  `stores/auth`; gated the list/detail management UI on it (was `isAdmin`).
- Made creation **invite-only**: removed `password` from the `UserCreate` type, the
  Create-User form (`UserForm.vue` now shows the password field only in edit mode),
  and the Bulk Create CSV (now `username,email,full_name,role`).
- **Client-side role ceiling** mirroring api 049: the Admin role option is hidden
  in `UserForm` for non-admins, and Admin-row edit/delete are hidden for non-admins.
- Removed the dead `register` api function + `RegisterRequest` type (the backend
  endpoint is gone).

### Why
Product wanted Leads to onboard users, no public self-signup, and no password
handling by staff — the email invite is the only way a password is set.

### Decisions / trade-offs
- **Reused the role hierarchy** (`canManageUsers = hasMinRole("lead")`) rather than
  hardcoding two roles — matches invariant "role checks via `stores/auth` flags".
- **Client guards are UX, not security** — the backend (api 049) is the authority;
  store actions still surface a 403 as a toast if a guard is bypassed.
- **Edit-mode password retained** — `UserUpdate.password` stays (admin direct set);
  only creation is invite-only.

### Cross-repo
Pairs with api-testoria plan 049 (removes `POST /auth/register`, opens `/users*` to
Lead+Admin, drops the password field, enforces the Lead-capped-at-Lead guard).

### Follow-up (same day) — bulk error panel contract fix
Aligned `UserBulkResult` to the real backend shape: `created: number` (was
mistyped as `User[]`) and `errors: BulkCreateError[]` (`{ index, username?,
email?, detail }`, was `{ index, username, error }`). The panel previously
rendered blank `username`/`error`; it now shows `Row N (email): <detail>` with
the backend's specific message. `stores/users.bulkCreateUsers` bumps the total by
the count and lets the view refetch (no more `unshift` of a number). Bulk error
panel restyled with `--danger-color` + `color-mix` so it's readable in dark mode
(was fixed light `--red-*` values).

---

## 2026-06-03 — Plan-097: Forgot-password & set-password (invite) flow

### What
Added the public, pre-auth recovery screens that consume api-testoria plan 048's three new endpoints: `ForgotPasswordView.vue` (email → no-enumeration confirmation), `ResetPasswordView.vue` (validate-on-mount → set password), a "Forgot password?" link on `LoginView.vue`, three public routes (`/forgot-password`, `/reset-password`, `/set-password`), `forgotPassword`/`resetPassword`/`validateResetToken` in `api/auth` + matching `stores/auth` actions, and the recovery DTOs in `types/auth`. Made `password` optional on `UserCreate`/the admin Create-User form so new accounts can be created without a password and onboarded via the welcome invite link.

### Key choices
- **One component for `/reset-password` and `/set-password`.** Identical mechanics (validate token → set password); only the heading/intro copy differs, driven by `route.name`. Avoids duplicating the form.
- **Validate the token on mount**, not on submit. An expired/used/missing token shows a clear "request a new link" recovery state up front instead of failing after the user types a password. If the token dies between validation and submit, the view falls back to that same state.
- **Recovery logic lives in `stores/auth`.** Even though these are pre-auth screens, the component → store → api invariant (#1) holds; the actions expose `loading`/`error` the views bind to. Added an `error` ref to the auth store for this.
- **Mirror backend no-enumeration in the UI.** The forgot-password confirmation is identical whether or not the email exists; a genuine network failure is folded into the same confirmation. Token errors return a generic invalid-link state.
- **Client password rule kept stricter than the server.** 8-char client minimum + confirm-match; the backend only enforces non-empty, so client-valid input never bounces as a `422`. Server `error` stays the source of truth if the backend tightens its policy.
- **Route paths are the cross-repo contract.** `/set-password` + `/reset-password` + `?token=` are exactly what api 048 builds its email links to via `FRONTEND_BASE_URL`.

### Dependency
- Ships after/alongside **api-testoria plan 048** (Gmail SMTP outbox + the recovery endpoints). The two backend-dependent e2e happy paths are `test.fixme` until 048 lands; the frontend-only behaviours (navigation, no-enumeration confirmation, invalid-link states) are covered by passing unit/component/e2e tests.

### Tech debt added
- Forgot-password confirmation has no resend control and no client-side rate-limit feedback.
- Bulk Create still requires a password per CSV row; the invite flow is wired into the single-user form only.

---

## 2026-06-01 — Plan-096: Move the edge proxy to host nginx; drop the web prod container (web slice of api plan 047)

### What
This repo no longer owns or runs the edge reverse proxy. Deleted `nginx.conf` (the inner SPA container server), `proxy/nginx.conf` (the edge that routed api/s3), `docker-compose.prod.yml`, and `Dockerfile`. The SPA is now served as static files from disk by **host-level nginx** via `deploy/web.vhost.conf` (mounted to `/etc/nginx/sites-available/` on the host). The `Pipeline` workflow dropped the `build-and-push` Docker job; `deploy` now builds `dist/` on the runner, scp's it to the host, flips a `current` symlink under `/var/www/testoria/releases/`, installs the vhost, and `sudo systemctl reload nginx`. Full context and host runbook live in `api-testoria` plan 047 / `api-testoria/deploy/README.md`.

### Key choices
- **Serve `dist/` from disk, no web container.** With host nginx already terminating TLS, an inner nginx container is pure overhead. The gzip / asset-cache / `index.html` no-cache / security-header rules from the old `nginx.conf` were folded verbatim into `deploy/web.vhost.conf`.
- **No Docker image for the frontend at all.** CI builds `dist/` directly (it already ran on a Node runner) and rsyncs it; no GHCR push, no `web` service. Simpler and faster.
- **Per-app vhost + cert.** This repo owns only `testoria.gammait.net` (vhost + cert); `api.*`/`s3.*` belong to `api-testoria`. The shared `testoria-proxy` docker network this repo used to create is gone.
- **Atomic releases via symlink flip** under `/var/www/testoria/releases/<sha>` with a `current` pointer; keep the last 5, prune the rest.

### Tech debt resolved
- This repo no longer owns routing/TLS for the API or MinIO; the cross-repo proxy coupling and the docker-network bootstrap ordering are gone.

### Tech debt added
- **Deploy needs passwordless sudo on the host** (write `/etc/nginx`, reload nginx, manage `/var/www/testoria`). Scoped via `sudoers.d`; see `api-testoria/deploy/README.md`.

### Notes
- Response headers must match the old setup after dropping the inner nginx — verify `Cache-Control`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and gzip on a real response during cutover.

---

## 2026-05-11 — Plan-095: Unify priority Tag colors across list and detail views (TES-81)

### What
`TestCaseSection.vue` was the only surface in the app rendering a priority chip from a hand-rolled `<span class="priority-badge">` backed by a separate `PRIORITY_COLORS` hex map (`medium: #eab308` — yellow). Every other surface (detail view, editor, run-create wizard, run-execute view, tree selector) renders a PrimeVue `<Tag :severity="getPrioritySeverity(...)">` where `medium → info` (theme blue). Same case looked yellow in the list and blue everywhere else. Swapped the list to the shared Tag pattern, removed the now-orphaned `PRIORITY_COLORS` constant, and fixed the label casing (list used the raw enum `"medium"` while every other surface used `PRIORITY_LABELS["medium"] === "Medium"`).

### Key choices
- **Use the existing severity helper, not a new constant.** `getPrioritySeverity` was already the de facto source of truth across the app; promoting the list view to it makes the existing pattern the single source. No new color primitive introduced.
- **Drop `PRIORITY_COLORS` entirely.** Zero remaining consumers after the swap; `grep -r PRIORITY_COLORS src/` confirms. Avoids dead code that would invite another inconsistency on the next "add a colored chip" task.
- **Render `PRIORITY_LABELS[priority]` as the Tag value.** Matches the run-create wizard and execute view; closes the secondary case-mismatch bug (raw `"medium"` vs `"Medium"`).
- **PDF exporter's separate RGB map stays untouched.** Different output medium; consolidating the four sources (CSS vars, TS constant, PDF RGB, Excel ARGB) into one definition is already tracked as the long-standing "Status color duplication across four sources (plan-048)" tech-debt item. Folding that work into this bug fix would expand scope unnecessarily.
- **No new tests.** Visual swap with build + lint coverage; if a regression matters in the future, snapshot tests on `TestCaseSection.vue` are the right addition — deferred.

### Tech debt resolved
None directly. Closes one symptom of the long-standing "color sources of truth are split across the codebase" pattern but the broader four-source duplication entry (plan-048) is still open for PDF / Excel / CSS-var unification.

### Tech debt added
None.

---

## 2026-05-11 — Plan-094: Promote "Add Section" discoverability across the test-cases page (TES-73)

### What
The test-cases page hid the "Add Section" affordance behind a tooltip-only `+` icon in the sidebar header, and the no-suites empty state offered only `Add Test Case` — a CTA that leads to a dialog the user cannot complete because no suite exists to attach the case to. Inside any section, the bottom-row "Add Case" and "Add Subsection" affordances were rendered as small text links (`<a class="action-link">`) that read as footnotes rather than actions. Promoted the sidebar `+` to a labelled `Add Section` Button (`[data-testid="add-section-btn"]`). Rewrote the empty state to surface `Add Section` as the primary CTA when the project has zero suites, with a disabled-with-tooltip `Add Test Case` secondary; flipped the slots when suites exist but no cases. Replaced the text-link section actions with PrimeVue `<Button text size="small">` components carrying the same handlers and role gate.

### Key choices
- **Branch the empty state on `hasAnySuites`, not `selectedSuiteId`.** The bug was that the first CTA shown — `Add Test Case` — is unactionable without any suite to attach the case to. A predicate keyed on whether the project has any suites at all picks the correct primary slot, regardless of whether the user is filtering by a specific suite.
- **Keep both CTAs visible, primary + secondary.** A single primary button hides the alternate path; surfacing both with explicit primacy lets a user who lands on the wrong empty state still recover with one click. The disabled `Add Test Case` carries an explainer tooltip — "Create a section first" — so the disabled state isn't mysterious.
- **Promote the sidebar `+` to a labelled button, not a chip or a menu item.** The button is the only "create top-level section" surface outside the empty state. The label costs a handful of horizontal px in a panel header that already has room (the panel is fixed at ≥260px on tablet+; the mobile breakpoint hides this panel entirely). Tooltip stays for icon-recognition / accessibility.
- **Convert section-action anchors to Buttons, drop the `|` divider.** PrimeVue `<Button text>` is the established secondary-action language across the app (Cancel, Back, etc.). Anchor tags read as navigation and conflict with the role gate that's already in place; the divider was a styling tax that buttons don't need.
- **Reused `data-testid`s on the prominent buttons.** Existing handlers continue to flow through the same `add-suite` / `add-case` / `add-subsection` emits — the wiring in `TestCaseTreeView` and `TestCaseListView` doesn't change. New `data-testid`s on the empty-state buttons + the labelled sidebar button + the section action buttons give e2e selectors that survive future copy tweaks.
- **No backend changes.** The bug is purely a discoverability / CTA-promotion issue; the create flows for suites and cases already exist.

### Tech debt resolved
None.

### Tech debt added
None.

---

## 2026-05-11 — Plan-093: Drag-and-drop reorder for sections, subsections, and test cases (TES-69)

### What
The suite tree had no drag-and-drop wiring anywhere; once a user created sections, subsections, or cases, the only way to reorder them was to rename them alphabetically (the suite tree sorted by name). Added native HTML5 DnD to two surfaces: `TestSuiteTree.vue` (sidebar suite tree, top-level sections and subsections) and `TestCaseSection.vue` (case rows within a section). Drag-and-drop is gated on `canManageTests`. A 2px primary-coloured indicator paints on the row edge to mark the drop slot; same-parent / same-suite constraint is enforced both visually (`not-allowed` cursor when invalid) and in the composable's `onDrop` guard. On drop, gap-based math computes a new integer `display_order`; a single PUT carries the change. Optimistic local reorder reverts on failure with an error toast. Paired backend work: api plan-046 (adds `display_order` to `test_cases` + cycle check on suite re-parent).

### Key choices
- **Native HTML5 DnD, no library.** `TestStepsEditor.vue` already uses the same primitive and works; pulling in `vuedraggable`/SortableJS would add a dependency for a single behaviour. If cross-parent / nested-sortable / auto-scroll is needed later, revisit then.
- **Extract `useTreeDnd<T>` composable in `src/composables/`.** Two surfaces use the same DnD logic. Duplicating dragstart/dragover/drop across both diverges; one composable owns the gap math, the scope check, and the indicator state. Pure-function `computeNewOrder(...)` is exported separately so the unit tests don't need a DOM.
- **Gap-based `display_order` with `REORDER_GAP = 1000`.** Floor-integer bisect; collapses to `prev + 1` after enough bisects on a tight gap (tracked as tech debt on both repos). One PUT per drop, no bulk endpoint — drops touch one row only.
- **Same-parent scope strictly enforced.** The composable's `scopeKey` is `parent_suite_id ?? -1` for suites and `suite_id` for cases. Cross-scope drops are silently rejected (no PUT fires, no visual change). Re-parenting and cross-section moves stay in the existing Edit flows; this plan was explicitly scoped to the "reorder among siblings" primitive.
- **Optimistic + rollback, not wait-for-PUT.** Wait-for-PUT means every drop feels laggy on real-world latency. Optimistic reorder updates the rendered list immediately; a per-list snapshot (`casesBySuite[suiteId]`, `testCases`, `allCases[projectId]`) is restored on failure. Acknowledges a documented exception to RELIABILITY.md's "no optimistic updates" rule.
- **Sort change in both stores.** `testSuitesStore.suiteTree` was sorting by `name.localeCompare` — switched to `(display_order NULLS LAST, name)`. `TestCaseTreeView.testCasesBySuite` now sorts each per-suite group by `(display_order NULLS LAST, id)`. The backend already sorts the same way on the wire, but the client sort keeps the optimistic mutation visually correct without a refetch.
- **One `data-testid` per row attribute.** Existing tree row test selectors (`[data-tree-item]`) are kept untouched; the drop indicator uses class state, not new selectors.
- **Recursive `TestSuiteTree` keeps per-level DnD scope.** Each instance only attaches drag handlers to the rows it directly renders (`props.suites`). Children mount their own `TestSuiteTree` and register independently — sibling scope naturally falls out because every row at one level shares `parent_suite_id`. Reorder events bubble up through `@reorder-suite` until they hit `TestCaseListView`'s handler.

### Tech debt resolved
None.

### Tech debt added
- **Cross-parent drag-and-drop (section → section, case → section).** v1 explicitly excludes these — covered by the existing Edit flows. Open a plan when there's user demand.
- **Order-rebalance helper when integer gaps collapse.** Pairs with api plan-046's matching tech-debt entry. The FE side is "detect tight gaps after a drop and trigger a renumber call" if the backend exposes one.
- **Touch-DnD on mobile.** The mobile breakpoint hides the suite panel entirely; reorder is a desktop interaction for v1.
- **Keyboard-driven reorder (Alt + ↑ / ↓).** Separate UX surface; pair with the existing keyboard nav (`data-keyboard-nav-tree`) when added.

---

## 2026-05-11 — Plan-092: Block Test Run wizard when project has no cases (TES-76)

### What
The Create Test Run wizard's step 2 (`Select Test Cases`) displayed the hint *"No test suites available. Create test suites and test cases first."* but left both proceed buttons (`Skip — create without cases`, `Next with 0 cases`) active, contradicting the guidance and producing run records in projects with nothing to run. Added a `projectHasNoCases` computed in `TestRunCreateView.vue` keyed on `Object.values(testCasesStore.casesBySuite).flat().length === 0`; bound `:disabled` on both proceed buttons; extended the empty-state copy with a second variant for the "suites exist but every suite is empty" case that today was silent. Playwright case covers the disabled state by intercepting `/projects/:id/test-suites` to return `[]`.

### Key choices
- **Predicate keys on cases, not suites.** One predicate covers both empty states (no suites; suites but no cases). Suites-existing-but-empty was silently allowed today — fixing the visible bug surfaces it as the same problem with the same fix.
- **Preserve the plan-069 empty-run path.** The intentional zero-selection flow for projects that *do* have cases stays untouched. The predicate is project-wide case availability, not selection size, so a populated project with zero ticked boxes is never blocked.
- **`:disabled`, not `v-if`.** Keeps the buttons visible so the user understands the action is intentionally blocked, not missing — same pattern as Save buttons in Edit dialogs when nothing has changed. The existing `v-if="selectedCaseIds.size === 0"` on the Skip button stays as-is.
- **Two warning copy variants, both above the action row.** The pre-existing "no suites" copy is kept verbatim to preserve any matching test selectors; a new "no cases in any suite" variant closes the previously silent failure mode. A `data-testid="create-empty-message"` selector lets e2e key on the hint regardless of variant.
- **Reuse existing `data-testid`s for the buttons.** `create-skip-cases-btn` and `create-next-btn` already exist; tests assert `toBeDisabled()` rather than introducing new selectors.
- **No API change needed.** The backend correctly supports empty runs by design (BE plan-034 + FE plan-069). The bug was purely a wizard UX contradiction; no defensive validation belongs at the API layer for this case.

### Tech debt resolved
None.

### Tech debt added
None.

---

## 2026-05-11 — Plan-091: Edit / Archive / Delete on project detail page; shared `EditProjectDialog` (TES-71)

### What
`ProjectDetailView` (`/projects/:id`) had no Edit / Archive / Delete affordance — those actions only existed as per-row icon buttons on the list view. Added Edit (lead+) and Delete (admin) buttons to the detail-page header. Extracted the previously-inline Edit modal in `ProjectListView` into a shared `EditProjectDialog.vue` component under `src/components/projects/`, consumed by both list and detail views.

### Key choices
- **Extract the dialog now, not later.** With two consumers the dialog needs to live somewhere shared. `EditTestRunDialog.vue` already established this pattern under `src/components/test-runs/`; mirroring it for projects keeps the conventions consistent. Without extraction, copy-pasting into the detail view creates two-source-of-truth drift on validation rules and payload shape — the same class of bug TES-78 surfaced for status badges.
- **The dialog owns its `updateProject` call.** Matches `EditTestRunDialog`'s behaviour: the parent listens to `saved` only if it needs post-save side-effects. Store mutation flows into both the list row and the detail page automatically, so neither parent needs a refetch.
- **Diff-aware payload.** The dialog emits only the changed fields via the same diff pattern `EditTestRunDialog` uses (`patch.value` is built by comparing `form` to `original`). Save is disabled when nothing has changed or the name is empty — matches the established UX.
- **Detail-page Delete navigates to `/projects` on success.** Staying on `/projects/:id` after deleting that project is a guaranteed 404 on next refresh. The list view's per-row Delete keeps the user in place because the row just vanishes — different UX for the same destructive action, both correct for their context.
- **Same role gates as list view.** Edit = `isProjectManager` (lead+). Delete = `isAdmin`. No new role concepts.
- **Cascade-warning copy reused verbatim from the list view's `confirmDeleteProject`.** Identical wording = identical user expectation; consistent messaging is the bug-prevention story for a destructive action.
- **Per-row delete UX in the list view is unchanged.** The bug is about the detail page; touching the list's per-row affordance would risk regression for no benefit.
- **E2E for the existing `Show archived` flow migrated** from `#edit-archived` (the old inline-dialog id) to `[data-testid="edit-project-archived"]` (the new dialog) so both flows stay green against the new component.

### Tech debt resolved
None.

### Tech debt added
None. The create-project dialog stays inline in `ProjectListView`; only the list view creates projects, and there's no second consumer to deduplicate against today.

---

## 2026-05-11 — Plan-090: relocate PrimeVue success Toast to bottom-right (TES-74)

### What
The global `<Toast />` in `App.vue` was using PrimeVue's default `top-right` position — exactly where every page header puts its primary action buttons (**New Test Suite**, **New Test Run**, **Edit**, **Create**). Action-feedback toasts ("Project created", etc.) sat on top of those buttons for ~5s and absorbed clicks. Moved to `position="bottom-right"` — empty lane in every view, modern convention (Linear/GitHub/Slack), single one-line change.

### Key choices
- **`bottom-right`, not `top-center` or `bottom-center`.** Bottom-right is the modern norm for non-modal action feedback. `top-center` would cover the page title; `bottom-center` would float over centered dialog overlays.
- **Single prop change, no CSS override.** PrimeVue's `position="bottom-right"` emits the right `.p-toast-bottom-right` class with built-in fixed positioning. Adding scoped CSS would risk drifting from PrimeVue's responsive defaults.
- **Don't touch `NotificationToast` (the realtime-notifications component).** It also lives top-right but already passes clicks through via `pointer-events: none` on its container — not part of this bug. Two top-right islands aren't ideal long-term but the bug is specifically about clicks being absorbed; relocating only the action toast solves it without disturbing the realtime UX.
- **No new wrapper around `useToast`.** All ~50 call sites continue calling `toast.add({...})` exactly as before. Only the visual lane changes; the API surface is untouched.
- **Comment in `App.vue` explains the rationale** so future contributors don't drop a fixed bottom-right control (chat widget, scroll-to-top) into the same lane and recreate the overlap.

### Tech debt resolved
None.

### Tech debt added
None. Long-term: the two top-right toast systems (PrimeVue + custom `NotificationToast`) could be unified into one notification surface, but neither is causing user-visible issues right now.

---

## 2026-05-11 — Plan-089: Cancel button on every step of Create Test Run wizard (TES-72)

### What
The Create Test Run wizard had no Cancel affordance — to abort, users had to navigate away or refresh. Added a `Cancel` button to all three step button rows. The button reuses the `backTarget` computed introduced in plan-086, so its destination always matches the page-header back button: `/projects/:id` when launched from a project (`?projectId=<id>` query), `/test-runs` otherwise.

### Key choices
- **Reuse `backTarget`, don't add a second routing source.** Cancel and the page-header back agree on where "exit" means. If a future entry context adds a new query convention, updating `backTarget` updates both buttons at once.
- **No confirmation modal.** Matches every other Cancel in the app (`EditTestRunDialog`, project/case create/edit). Adds friction to a fix whose purpose is *less* friction. Surface a "discard unsaved data?" prompt only if QA reports an actual incident.
- **Cancel as the first child of `.step-actions`.** With `justify-content: flex-end` and `gap: 12px`, that places Cancel on the far-left of the right-aligned cluster — physically separated from the forward-flow buttons (Next / Skip / Create) by the row's gap. Standard "escape vs proceed" arrangement.
- **`text severity="secondary"`.** Same visual weight as the existing `Back` button — Cancel reads as a non-primary action and the Step 3 `Create Test Run` primary button stays visually dominant.
- **Single `data-testid="create-cancel-btn"` selector across all three steps.** PrimeVue Stepper renders only the active StepPanel's children, so a `page.locator('[data-testid="create-cancel-btn"]')` always resolves to the active step's Cancel — no per-step suffixes needed.

### Tech debt resolved
None.

### Tech debt added
None.

---

## 2026-05-11 — Plan-088: 1-indexed step badges in Create Test Run wizard (TES-75)

### What
PrimeVue's `<Step :value=...>` renders the `value` as the visible step badge. The Create Test Run wizard had `:value="0"`, `:value="1"`, `:value="2"`, paired with `activeStep = ref(0)` — so users saw "0, 1, 2" instead of "1, 2, 3". Shifted all six numeric anchors plus the ref initial value plus the Step-1 validation guard by +1.

### Key choices
- **Renumber, don't switch to string keys.** `'basics' / 'cases' / 'review'` would be more readable but reshapes the `nextStep`/`prevStep` `++`/`--` arithmetic. For a Medium-priority cosmetic bug, the smaller blast radius wins.
- **Keep `activeStep` numeric.** Nothing outside the file (no store, no router, no telemetry) consumes the value — verified by grep — so the rename is internally complete.
- **E2E asserts the rendered badge text directly** (`page.locator('.p-stepper .p-step-number').nth(0).toHaveText('1')`), not a screenshot diff. Stable across PrimeVue minor bumps and clearly verifies user-visible behaviour.

### Tech debt resolved
None.

### Tech debt added
None.

---

## 2026-05-11 — Plan-087: align Blocked badge with `--status-blocked`, distinct from Passed (TES-78)

### What
The `StatusBadge` component mapped `blocked` to PrimeVue severity `warning`, which in some Aura palettes / displays / colour-vision conditions reads as the same green as severity `success` (passed). The Test Run detail pane was showing visually identical Blocked and Passed tags, which is a real misread risk for QA assessing a run. Realigned the four result-status badges to use explicit hex backgrounds + text colors that match the `--status-*` CSS variables already used by the suite-tree row indicators (`SuiteTreeBranch`). Blocked is now slate-600 (`#4b5563`) on white text — neutral, dimmed, and unmistakable next to the green Passed tag.

A dark-mode pass on `/test-runs/:id/execute` (the page where Blocked is most relevant) surfaced two more places where Blocked was misrendered: `.result-status-card.blocked` in `TestResultDetail.vue` used yellow (same `--yellow-50` family as the prior badge bug, same risk of looking like a passed card), and `.stat.blocked` / `.verdict-btn--blocked` on the execute view both rendered with too-low contrast against the dark page surface (`#0f172a`). All three were realigned to the slate palette, with explicit dark-mode overrides where AA contrast required them.

### Key choices
- **Custom palette only for `type="result"`; other tag types unchanged.** Smallest blast radius — fixes the bug without auditing `priority` / `run` / `type` tag rendering. Keeps the change reversible.
- **Reuse the canonical `--status-*` hex values.** The same `#4b5563` blocked / `#22c55e`-family passed / etc. that `SuiteTreeBranch` row dots and segment chips already use. Eliminates the prior split where the same run showed "blocked = gray" in the row indicator and "blocked = warning-yellow" in the badge.
- **WCAG AA verified per pair.** Passed `#166534 / #dcfce7` ≈ 7.5:1, failed `#991b1b / #fee2e2` ≈ 7.7:1, blocked `#ffffff / #4b5563` ≈ 8.6:1, no_run `#374151 / #f3f4f6` ≈ 11.0:1. All comfortably above the 4.5:1 floor.
- **Solid slate background for Blocked, not severity-`contrast`.** `contrast` is near-black; the bug reporter's suggested "grey background with dark/black text" is closer to slate-600. Slate also matches the existing `--status-blocked` token verbatim.
- **Lookup colocated in `StatusBadge.vue`, not hoisted to a shared constant.** Avoids forcing `RESULT_STATUS_COLORS` (currently bg-only) to grow text/bg pairs it doesn't need elsewhere. If a second consumer ever needs the pair, hoist then.
- **Severity defaults to `secondary` for result-type badges; the inline `:style` is the visual source of truth.** Lets the explicit hex pair always win, regardless of theme drift.
- **Regression guard in unit test**: explicit `expect(blockedBg).not.toEqual(passedBg)` — the very assertion that would have caught this bug had it existed.
- **Dark-mode follow-ups bundled in the same plan, not deferred.** Three adjacent surfaces (status card in detail pane, stat counter on execute view, verdict button on execute view) shared the same root cause — "blocked uses warning-yellow / near-black tokens" — so fixing them together is cheaper than three separate plans, and avoids a half-fixed visual language where one screen says blocked-is-slate and another says blocked-is-yellow. Specifically: blocked badge gets `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18)` in dark mode; `.stat.blocked` text bumps to slate-400 (`#94a3b8`) for AA; `.verdict-btn--blocked` swaps near-black `#1f2937` → slate-600 `#475569` + subtle white border in dark mode; `.result-status-card.blocked` drops the yellow tint in both modes.

### Tech debt resolved
None.

### Tech debt added
None. The duplicated `RESULT_STATUS_COLORS` ↔ `resultBadgeStyles` ↔ `--status-*` definitions are intentional and use identical hex values — a future hoist into a single source of truth is mechanical and not load-bearing today.

---

## 2026-05-11 — Plan-086: context-aware back button on Create Test Run (TES-80)

### What
The back button on `TestRunCreateView` always pushed to `/test-runs` and was labelled `Back to Test Runs`, regardless of where the user came from. Now it derives its label and destination from `route.query.projectId`: with the query param → **Back to Project Overview** → `/projects/:id`; without → **Back to Test Runs** → `/test-runs`. `ProjectDetailView.goToNewTestRun` was the missing link — it now passes `?projectId=<id>` on the push, which both feeds the back-button derivation and engages the existing `:disabled="!!route.query.projectId"` lock on the project Select.

### Key choices
- **Reuse `route.query.projectId` as the context signal, don't add a separate `from` param.** The query param is already consumed by the form for prefill + lock; one signal beats two. Avoids the redirect-injection surface a generic `from` would open.
- **Explicit `router.push` to the derived destination, not `router.back()`.** History is fragile: a deep-linked entry has no prior history; submit redirects pollute it. An explicit push works in every case and survives refresh.
- **Single `backTarget` computed produces both label and destination.** Eliminates the "label says X but destination is Y" class of bug — the very bug this plan fixes.
- **Pass `projectId` as a string in `router.push({ query })`.** Vue Router stringifies anyway; `String(projectId)` is self-documenting at the call site, and the form already coerces back via `Number(...)`.
- **Other entry points unchanged.** `TestRunListView` (×2) and `DashboardView` (×3) keep the default behaviour. The dashboard CTAs *could* opt in via the global selected-project, but the user mental model on the dashboard is "create a run", not "create a run *for the currently-selected project*"; deferred to a separate UX decision if QA asks.
- **`data-testid="create-back-btn"`** on the back button so e2e and future tests target a stable hook independent of the (now-dynamic) label text.

### Tech debt resolved
None.

### Tech debt added
None.

---

## 2026-05-11 — Plan-085: server-driven Show archived on /projects, rename `archived` → `include_archived` (TES-82)

### What
The Show archived checkbox on `/projects` was a no-op. Two compounding defects: `ProjectFilters.archived` sent the wrong query-param name (backend expects `include_archived`), and `ProjectListView` only fetched once on mount, then post-filtered the in-memory list — but the in-memory list never contained archived projects to begin with. Both fixed: `ProjectListView` re-fetches on toggle with `include_archived: showArchived.value`, and `ProjectFilters.archived` was renamed to `include_archived`.

### Key choices
- **Rename `ProjectFilters.archived` → `include_archived` rather than remap inside `getProjects`.** Aligns the type with the backend contract verbatim, and matches the existing `ProjectStatsBulkParams.include_archived` already in `types/project.ts`. Single name end-to-end. `vue-tsc` strict is the safety net for any missed callers (there were none).
- **Drop the client-side `is_archived` filter; server is the single source of truth.** A client-side post-filter on a paginated server response can produce a "page" with fewer rows than `page_size` claims, which is misleading. Search filtering stays client-side because the endpoint doesn't expose a search param yet.
- **Use a `watch(showArchived, ...)`, not an `@change` handler.** Triggers regardless of how the ref changes (programmatic, future URL-driven restore, etc.) and keeps the template free of imperative wiring. Matches existing filter-driven refetch patterns elsewhere.
- **Loading archived projects into the shared `projectsStore.projects` is safe.** Verified that all global consumers (`AppHeader.vue:23`, `TestRunCreateView.vue:60`, `usePassRateAggregation.ts:26`) explicitly filter `!p.is_archived` before rendering. No regression to the global project selector or aggregations.
- **Don't reset pagination on toggle.** Page number is preserved across toggles. Acceptable given current row counts; queue a reset-to-page-1 if QA reports the empty-page edge case.
- **Don't persist the toggle to localStorage / URL.** Out of scope; the bug is the no-op, not the UX of remembering the choice.
- **`data-testid="show-archived-checkbox"` on the PrimeVue Checkbox**, not just `inputId`. Stable target across PrimeVue version bumps.

### Tech debt resolved
None.

### Tech debt added
None.

---

## 2026-05-11 — Plan-084: split `edit` into `edit-test-case` + `execute-result` in TestResultDetail (TES-79)

### What
The result detail pane on a Test Run had two buttons (header pencil **Edit** and not-yet-run-panel **Execute**) wired to a single `edit` event. The parent's lone handler always pushed to `/test-runs/:id/execute`, so the header **Edit** sent the user to the in-run "Test cases list" instead of the test case editor. Bug TES-79.

### Key choices
- **Two distinct emits, not one with a discriminator.** `edit-test-case` (header pencil) and `execute-result` (Execute button). Two semantic intents → two events. Lets TypeScript catch a missing handler at the parent and avoids future divergence forcing a payload escape hatch.
- **Named-route push for the editor.** `router.push({ name: "TestCaseEdit", params: { id } })` rather than a string template — explicit dependency on the route name. The standalone `TestCaseDetailView.vue:92` still uses a string template; converting that is a small follow-up cleanup, out of scope here.
- **Header Edit is role-gated `v-if="authStore.isProjectManager"`.** The route already enforces `minRole: "lead"`. Showing the button to a Tester would have always landed on a guard bounce. Matches the gating pattern at `TestCaseDetailView.vue:89`.
- **Execute button keeps its existing route.** Same path, same query param shape; only the event name changed.
- **`data-testid` on both buttons** (`result-detail-edit-test-case`, `result-detail-execute`) so unit + Playwright tests can target them without coupling to label text.

### Tech debt resolved
None.

### Tech debt added
None.

---

## 2026-05-08 — Plan-083: round all percent values to 1 decimal everywhere

### What
Every rendered percent (Dashboard, Reports, run list, run detail, project detail, exports) is now exactly one decimal place, driven by a single helper. Pairs with api plan 044 (server-side rounding at the response boundary).

### Key choices
- **Two helpers, same rule.** `formatPassRate(ratio)` returns the string `"87.5%"` for direct rendering; `toPercentRounded(ratio, decimals=1)` returns `87.5` (number) for sites that compare against thresholds (`>= 80`, `< 50`) or feed chart-axis ticks. Both round identically so a value displayed as "87.5%" compares as `87.5`.
- **Defensive `> 1.5` clamp in `toPercent` stays.** It's a transitional safety net for api plan 035; removal is gated on plan 044 having been live for ≥ 2 weeks. Out of scope here.
- **Excel uses `numFmt: '0.0%'` with the raw ratio**, not a pre-formatted string. Spreadsheets handle percent display + sort natively; users get sort-by-rate for free. PDF still uses `formatPassRate` since PDFs are static.
- **`ProjectDetailView.vue:179` legacy bug fixed in the same pass.** That site rendered `{{ stats?.pass_rate || 0 }}%` — a 0..1 ratio displayed with a `%` suffix, so a project with 87.5% pass rate showed `0.875%`. Fixed to `formatPassRate(stats.pass_rate)`.
- **`stores/testResults.ts:76` legacy bug fixed too.** The optimistic `updateTestRunProgress` call stored `pass_rate` as a 0..100 percent (`(passed / total) * 100`) instead of a 0..1 ratio. Mismatched the wire shape that every other site assumes. Fixed to a ratio.
- **Mean computations stay raw + rounded once.** `DashboardView.passRateData` averages per-run rates with raw `toPercent` and rounds the mean once at the end (the same rule api plan 044 follows server-side).

### Tech debt resolved
- "Convert pass-rate ratio → percent at API-adapter layer (plan-076)" — closed.
- "Migrate remaining pass-rate sites to `formatPassRate` (plan-058)" — closed.

### Tech debt added
None. The `> 1.5` clamp removal is queued as a follow-up plan rather than tracked.

---

## 2026-05-08 — Plan-082: Reports page "All projects" mode

### What
Reports view (`/reports`) now renders aggregated metrics across all visible projects when the global selector is set to "All projects" (`projectsStore.selectedProjectId === null`), with a per-project breakdown row list. Pairs with api plan 043 (`GET /reports/analytics`).

### Key choices
- **Mode derived from the global selector**, not a local toggle. `mode = computed(() => selectedProjectId.value ? 'project' : 'all')` — single source of truth, no drift, no URL param.
- **Two store slots** (`analytics`, `crossProjectAnalytics`) instead of one polymorphic slot. Different shapes (cross-project lacks `project_id` and adds `per_project[]`), and keeping per-project data alive when flipping back gives instant rehydration. `clearProjectAnalytics()` / `clearCrossProjectAnalytics()` wipe selectively in the watcher before the new fetch resolves so a stale shape never leaks into a chart.
- **Shared chart pipeline** via an `activeAnalytics` computed (`crossProjectAnalytics ?? analytics`) — KPI cards, distribution donut, automation donut, pass-rate trend all read from one source. The per-project breakdown is the only mode-specific panel.
- **Breakdown rows are clickable** — clicking a project flips the selector via `projectsStore.setSelectedProject(id)` and the page rehydrates in per-project mode without a full reload. Most common follow-up after spotting an underperforming project.
- **Export disabled in 'all' mode** with tooltip. `useExcelExport` / `usePdfExport` are written around a single project's test cases and a single run's results — calling them with cross-project data would silently produce a wrong export. Multi-project export is tracked in tech debt rather than half-implemented.
- **Run dropdown labelling** — when a `RunAnalyticsItem` carries a `project_name` (which the cross-project endpoint always populates), the export dialog dropdown prefixes options with `<project_name> · <run_name>` so two runs sharing a name across projects are distinguishable.

### Tech debt added
- Multi-project Excel/PDF export — disabled rather than re-architected. Fix sketch: extend the export composables to accept a multi-project payload (one sheet per project, or a zip of per-project files), or generate per-project files concurrently.

### Tech debt resolved
None.

---

## 2026-04-27 — `s3.testoria.gammait.net` proxied to MinIO; pipeline auto-expands the SAN cert

### Bug context
After plan 100 (2026-04-22) shipped attachment uploads to MinIO, prod uploads were failing with `Could not connect to the endpoint URL: "http://localhost:9000/..."`. Root cause was on the api-testoria side (no MinIO service in the prod compose, no `S3_*` env vars), but the fix split across both repos: api-testoria added `S3_PUBLIC_ENDPOINT_URL` so presigned URLs reference a publicly-reachable hostname, and this repo owns the reverse-proxy route that turns that hostname into traffic to the MinIO container.

### Third public hostname: `s3.testoria.gammait.net`
The `nginx-proxy` container previously fronted two hostnames (`testoria.gammait.net` → SPA, `api.testoria.gammait.net` → API). Added a third — `s3.testoria.gammait.net` → `http://minio:9000` — for browser GETs of attachment presigned URLs. MinIO itself lives in the api-testoria compose stack but joins the external `testoria-proxy` docker network, so nginx can resolve `minio` via docker DNS the same way it does `api` and `web`.

### `proxy_set_header Host $host;` on the s3 server block
AWS SigV4 signs the Host header. Boto3 signs against `s3.testoria.gammait.net` (from the api's `S3_PUBLIC_ENDPOINT_URL`); MinIO recomputes the signature against whatever Host arrives. Any rewrite (e.g. nginx's default would forward the upstream's `Host: minio:9000`) returns 403 SignatureDoesNotMatch on every image load. Pinned `Host $host;` and added a comment in `proxy/nginx.conf` so this isn't accidentally "cleaned up" later.

### `proxy_buffering off` on the s3 block (only)
MinIO returns full file bodies up to `MAX_ATTACHMENT_BYTES` (10 MB on the api side). With default buffering, nginx stages the entire response to disk before sending — wastes IO and adds latency. The api/web blocks keep buffering on (small JSON / static assets) — only the s3 block changes the default.

### CD pipeline auto-expands the Let's Encrypt SAN cert
Adding a domain to nginx used to be a four-step manual ritual (DNS → push config → SSH → run certbot → reload nginx). The pipeline now runs `certbot certonly --expand --keep-until-expiring -d ... -d s3.testoria.gammait.net` after recreating nginx-proxy and before the final image prune. `--keep-until-expiring` makes it idempotent — no-op when SANs already match — so it's safe to run every deploy. Future new hostnames just need the `-d <hostname>` line added to the same step. Prereq: DNS for the new hostname must already point at the prod IP, otherwise the ACME HTTP-01 challenge fails and the deploy fails fast.

### Tech debt added
- The nginx config and the certbot domain list are in two places (`proxy/nginx.conf` server_names + `pipeline.yml` `-d` flags). Adding a fourth hostname requires updating both. Could be DRY'd by parsing `server_name` lines out of the config in CI.

---

## 2026-04-22 — Pasted screenshots round-trip to MinIO + inline display + report embed (plan 100)

### `Attachment.url` replaces `Attachment.file_path` in the TS type
Prior: the TS `Attachment` interface mirrored a backend field named `file_path` — but that field was a server-side filesystem path, not a URL. Every `<img :src="attachment.file_path">` in the codebase was rendering 404 silently; users thought their pasted screenshots weren't being saved when in fact they were, just not viewable. Plan 042 on the backend exposes a presigned `url` field; the FE type now carries `url: string` (required) and `file_path` is gone. Call sites in `TestRunExecutionView.vue`, `TestResultDetail.vue`, and `usePdfExport.ts` switched to `url`. `mime_type` also widened to `string | null` to match the backend.

### `uploadAttachmentsBulk` replaces per-file fan-out on save
Prior: `TestRunExecutionView.saveComment` and `TestRunDetailView.handleUpdateComment` looped `uploadAttachment(resultId, file)` per pasted image — N HTTP requests with N independent error surfaces. Switched to the new bulk endpoint; `testResultsStore.uploadAttachmentsBulk(resultId, files)` fires one multipart request carrying every file. Partial failures come back in `response.failed[]`; the UI keeps failed files staged so the user can retry, and toasts a single "N of M uploaded" summary. Matches the backend `BulkUploadResponse` shape.

### Store merges uploaded rows into `results[].attachments` in place
The bulk action doesn't refetch the run — it merges every `response.uploaded[]` attachment into the matching `results[id].attachments` array in place. Sibling results are untouched. `deleteAttachment` mirrors the pattern. Tests in `tests/unit/stores/testResults.spec.ts` pin the behaviour.

### PDF export embeds up to 3 screenshots per result
`usePdfExport.ts` previously skipped attachments entirely. Now it fetches each presigned URL via `fetch()` → `FileReader.readAsDataURL` → `doc.addImage` for up to 3 images per result (matching backend `REPORT_ATTACHMENT_MAX_PER_RESULT`). Overflow becomes a "+N more screenshot(s) — open run in app" line. Individual fetch failures fall back to a `[Image: {filename} — unavailable]` stub so one broken image doesn't break the whole export.

### Excel export adds a Screenshots sheet
`useExcelExport.ts` adds a dedicated "Screenshots" tab when any result has images. Uses `workbook.addImage({ buffer, extension })` + `worksheet.addImage` with a fixed 300×200 thumbnail anchored to each case's row. Same 3-per-result cap; `+N more` text in the cell on overflow.

### New `ResultAttachmentGallery.vue` component
Thumbnail strip + PrimeVue Dialog lightbox. Emits `reload-requested` when `<img>` load errors are detected (presigned URL expiry → parent refetches). Component is presentational (takes `attachments` as a prop, no store access) so it can live under both the detail panel and future inline views without cross-store coupling.

### Tech debt resolved
- `Payload builder duplication — saveComment and submitResult build nearly-identical result payloads`: the shared bulk-upload path means attachment handling now goes through one code path in both save flows.

### Tech debt added
- Plan 042's backend `storage_backend='local'` shim-rows need migrating via the backend's `scripts/migrate_attachments_to_minio.py` before the legacy fallback URL route can be removed.
- URL-expiry refresh: today the `ResultAttachmentGallery` surfaces a "Reload images" button when the browser's `<img>` 403s; a future improvement is an Axios interceptor that proactively refreshes URLs near TTL expiry.
- Global-scope `document` paste listeners in `TestRunExecutionView.vue` and `TestResultDetail.vue` are still in place (they pre-date plan 100); the plan logged a follow-up to scope paste handling to the `ImageUploadArea` component boundary — deferred since the existing handlers already iterate all image items correctly.

---

## 2024

### Chose Vue 3 + Composition API as frontend framework
See ADR-001. Vue 3 with `<script setup lang="ts">` is the standard; no Options API.

### Chose Pinia for state management
See ADR-002. One store per domain, composition-style only.

### Established layer boundary: no component imports from api/
Components and views must go through stores. Enforced via code review and documented in `ARCHITECTURE.md`.

### Added mock layer as first-class dev tool (later removed 2026-04-06)
`src/mock/` was a complete offline development mode. Removed in plan-018 when all API domains were wired to the real backend.

### Chose PrimeVue 4 as UI component library
Single UI library for consistency. No mixing with other component frameworks (Vuetify, Element Plus, etc.).

### Chose Tiptap 3 for rich text editing
Used for test case descriptions, preconditions, and result comments. Renders HTML stored in the database.

### Chose ExcelJS + jsPDF for export
ExcelJS for `.xlsx` (multi-sheet, styled). jsPDF + jspdf-autotable for PDF. `useExcelExport` and `usePdfExport` composables wrap these.

### Containerized deployment with multi-stage Docker build
Node build stage → nginx serve stage. Production: three containers (web + nginx-proxy + certbot) via `docker-compose.prod.yml`. Deployed to EC2 via GitHub Actions.

### Token storage: localStorage with Axios interceptor + store dual-write
`api/client.ts` reads tokens from localStorage on every request. `stores/auth` writes/clears tokens on login/logout. Both operate independently — this is intentional so the Axios interceptor works without needing a Pinia store reference.

---

## 2026-04-22

### Reports automation-coverage donut fixed (api follow-up)
Every project that hadn't wired a CI `automation_id` onto its cases was rendering as "100% manual" on the Reports page — regardless of how many cases were classified `type='automated'`. Backend now counts automated cases via the `type` flag (see api changelog). No frontend code change — `metrics.automation_coverage` reads `by_automation.automated / summary.total_test_cases`; the numerator is now the right one.

### Reports `overall_pass_rate` aligned with `TestRun.progress.pass_rate` (api plan-041 follow-up)
User reported Dashboard showing 83.3% and Reports showing 100% for the same project. Root cause: the Reports summary's per-run rate used `passed / result_rows` while the Dashboard-facing `TestRun.progress.pass_rate` used `passed / max(cases_in_scope, tested)`. For a run with untested cases the two diverged. Backend now delegates both to `test_run_service.batch_run_progress` so the Dashboard Overall tile, per-project breakdown rows, and Reports KPI all derive from one per-run definition. No frontend code change required — Reports still reads `summary.overall_pass_rate`; it's the value that's now correct.

### Overall pass rate redefined as mean of completed-run rates (plan-080)
Superseding plan-079's weighted `sum(passed)/sum(total)` design: the Dashboard "Overall Pass Rate" now computes as the arithmetic mean of each completed run's own pass rate across the current scope — `mean(run.progress.pass_rate for run in filteredTestRuns where run.status === 'completed' && run.progress.pass_rate != null)`. The per-project breakdown rows continue to display `s.pass_rate` from bulk stats, which the backend (api plan-041) also switched to the same mean-of-rates rule, so the Dashboard overall, per-project breakdown, and Reports KPI all share one definition. The `passed_results` / `total_results` fields added to `ProjectStatsItem` in plan-079 are removed (backend drops them; frontend type no longer exposes them) — they encoded the rejected weighted semantic. Sublabel on the tile updated to "Average across completed runs". Select Run filter behaviour from plan-079 is unchanged. The threshold-based colour switching on the headline (`text-success`/`text-warning`/`text-danger` at 60/80) is removed — the figure now always renders in `var(--status-passed)` (canonical passed green) via a new `.pass-rate-value` class, matching the "pass rate always green" convention already applied on the per-run progress bars. On the Reports page the same semantic applies: the "Overall Pass Rate" summary card also renders in `var(--status-passed)` (was a hard-coded `#22c55e`) and the local field was renamed `metrics.average_pass_rate` → `metrics.overall_pass_rate` to match the label and the backend field name.

### Dashboard overall pass rate switched to weighted sum + Select Run filter; Reports label rename (plan-079)
`DashboardView.passRateData.overall` no longer averages per-project pass-rate percentages — it now computes `sum(passed_results) / sum(total_results)` across the scoped projects, so a project with 100 runs weighs 100× a project with 1 run rather than equally. The raw counts come from two new fields on `ProjectStatsItem` (`passed_results`, `total_results`), wired through `src/types/project.ts` and populated by api-testoria plan-040. A new "Select Run" PrimeVue `Select` in the page header scopes metric cards, the results doughnut, and the recent-runs list to a single run (the pass-rate trend stays aggregated — one-run trend would be noise). The run filter clears automatically when the project filter changes. On the Reports page the KPI card labelled "Average Pass Rate" is renamed to "Overall Pass Rate" — the backend value (`overall_pass_rate` from `/reports/analytics/{id}`) was already a weighted per-project-all-completed-runs rate, so only the label changed.

### Shared suite-tree results view on detail + execute pages (plan-068)
Both `/test-runs/:id` and `/test-runs/:id/execute` now render case lists via a single `<SuiteTreeResults>` component (`src/components/test-runs/SuiteTreeResults.vue`, with its recursive branch in `SuiteTreeBranch.vue`). A `mode` prop switches between `read` (result-card-style rows for the detail panel) and `execute` (compact picker rows with status indicator). Per-suite branch headers carry counts + a compact passed/failed/blocked/no_run chip strip sourced from the same tree walk. Collapse state is persisted in `localStorage` under `testoria.suiteTree.collapsed[runId]` with a 50-run cap trim, so walking a run and switching pages keeps the tester's navigation state. The execute view's auto-advance now walks the tree in DFS render order via `SuiteTreeResults.findNextUntestedAfter` (exposed via `defineExpose`) — no more flat-sort-by-id. Data source stays client-side (existing `runCases` + `results` + `suiteTree`); swapping to api plan-034's `?group_by=suite` endpoint once it lands is tracked as tech debt. The legacy `SuiteResultSection`, `SuiteCaseSection`, and `TestResultCard` components are deleted.

### Test run lifecycle renamed `in_progress` → `active` + completed-only dashboard (plan-070)
`TestRunStatus` now canonically reads `"planned" | "active" | "completed" | "aborted"`. A small `normaliseRunStatus` helper in `src/api/testRuns.ts` converts legacy `in_progress` responses to `active` on read so the rest of the app only ever observes the canonical value — giving us one-release compat while the API (plan-039) rolls out. Outgoing writes never send a status, so no write-path compat is needed. `RUN_STATUS_LABELS` maps `active → "Active"`, and the UI gives `active` a `warning` (orange) severity in the list, detail, execution, dashboard, reports, and StatusBadge surfaces — visually signalling "in flight" rather than the old blue `info`. `TestRunExecutionView.submitResult` optimistically flips a `planned` run to `active` on first result submit (the subsequent `fetchTestRun` confirms or corrects). `DashboardView`'s overall-pass-rate tile carries a new `.metric-sublabel` caption: "Based on completed runs only" when data exists, "No completed runs yet" when the overall is null. The plan's Centrifugo subscription is deferred because no WS infrastructure exists in the frontend yet — tracked as tech debt.

### Empty test run + Add Cases CTA (plan-069)
The create wizard's step 2 now exposes a "Skip — create without cases" button when 0 cases are selected, and the Next button re-labels to "Next with 0 cases" to make the empty-selection path explicit. Step 3 already handled the 0-selection case and submits `include_test_cases: []`. `TestRunDetailView` forwards an `@edit-cases` event from `TestResultsList` into the existing `showEditCasesDialog`, and `TestResultsList` renders an "Add Cases" primary CTA in its empty state when the run has zero results and `canEditCases` is true. A small "Manual cases" tag surfaces next to the run name when `cases_mode === "explicit"`, clarifying that the case list was manually set. The underlying dialog, store action, and API wrapper already landed with plan-069's partial merge on 2026-04-20.

### Test runs list progress bar in canonical passed green (plan-071)
`TestRunListView` drops the 70/90 traffic-light `getProgressColor` helper and the red/amber/green `pass-rate-bar-{success,warning,danger}` class variants. The progress bar now uses the single `.pass-rate-bar` class backed by `var(--status-passed)` (the CSS mirror of `RESULT_STATUS_COLORS.passed`), and the pass-rate numeric label inherits the same green. An empty run (`total === 0`) renders a 0% green track rather than a misleading red one.

### Execution view saveComment persists per-step status (plan-072)
The comment-panel dirty check in `TestRunExecutionView` now compares the step-results draft (`testResultsStore.stepResultsDraft[caseId]`) against the loaded result's `step_results` via a value-level comparator (`stepDraftDiffersFromResult`, local to the view; sorts both sides by `index` and coerces comments to `""` so backend ordering and nullability don't create false positives). `saveComment()` now includes `step_results: stepDraft.length > 0 ? stepDraft : undefined` in the payload — matching `submitResult()`'s pattern — so step statuses entered without a full verdict submit persist through `PUT /test-results/{id}`. The full-submit path was already correct and is untouched.

### Detail view persists comment edits via updateResult (plan-073)
`TestRunDetailView` now listens for `update-comment` on `TestResultDetail` and calls `testResultsStore.updateResult(resultId, { comment })` (plus `uploadAttachment` for any new images, followed by `fetchRunCasesWithResults` so attachments surface). The misleading unconditional success toast in `TestResultDetail.saveComment()` is gone — the component only emits; the parent owns the async outcome and toasts success on resolve or error on reject. On error the edit panel stays open so the typed comment isn't lost. `TestResultDetail` now accepts an `is-saving` prop (loading state on the Save button) and exposes `resetCommentEdit` via `defineExpose` so the parent can close edit mode after a successful save.

### Dashboard Recent Test Runs uses formatPassRate + passed green (plan-074)
`DashboardView` now renders each Recent Test Runs row's pass-rate bar using the canonical 0..1 → percent conversion (`toPercent` / `formatPassRate` from `src/utils/passRate.ts`) and colours the bar with `RESULT_STATUS_COLORS.passed` — matching plan-050's "always in green" dashboard convention. Null pass-rate rows (no finalised results) render "—" and hide the bar. The existing `.progress-mini` CSS mirrors the breakdown-bar's `:deep(.p-progressbar-value)` override for a reliable green track across PrimeVue versions.

### Suite selection on test-cases page now scopes to parent level + descendants (plan-075)
`TestCaseTreeView` introduces `getParentSuiteId` + an `effectiveScopeSuiteId` computed. Selecting a child suite now shows the parent suite's section plus every descendant (siblings + their subtrees). Top-level selections behave as before (own subtree only). The left-tree highlight still stays on the user-clicked suite; only the right-panel case scope promotes.

### Reports KPI + trend use percent conversion and passed green (plan-076)
`ReportDashboardView` converts the backend's 0..1 `overall_pass_rate` ratio to percent via `toPercent` before rendering the "Average Pass Rate" KPI. Trend points preserve `null` for empty days and render as gaps in the Chart.js line via `spanGaps: true` (instead of silently plotting zero). The threshold-driven traffic-light classes (`text-success`/`text-warning`/`text-danger` at 60/80) are removed from the KPI — the number always renders in canonical passed green — matching plan-050's dashboard convention and plan-071 / plan-074's progress-bar treatments. The two conditional insight banners keyed off `average_pass_rate` ("below 80" warning, ">= 90" praise) are dropped; the automation-coverage and critical-priority banners remain.

### Edit Cases dialog refetches suites and cases on open (plan-077)
`EditRunCasesDialog.loadAllSuiteCases` now always calls `testSuitesStore.fetchTestSuites(projectId)` and a new `testCasesStore.refreshCasesBySuite(projectId, suiteId)` per suite — bypassing the per-suite cache that previously masked updates from other tabs/sessions. After the refresh, any initial selection ids that no longer correspond to an existing case are silently pruned and a warning toast surfaces the drop count. `handleExpandSuite` keeps its cache short-circuit for on-demand expansion (the open-time fan-out already seeded the cache).

### Dashboard doughnut shows leader-line % labels (plan-078)
`DoughnutChart` registers a scoped Chart.js plugin (`leaderLineLabelsPlugin`) that draws a 2-segment leader line from each non-zero arc's outer midpoint to a `"<label> <pct.n>%"` callout. Zero-value slices are skipped (still present in the side legend; a leader line into an empty arc would be noise). Labels use the `--text-color` CSS var (with `#334155` fallback) so they remain legible in both themes. The component merges `layout.padding` onto the caller's options so labels don't clip at standard dashboard widths.

---

## 2026-04-20

### Edit a test run's case list from the detail page (plan-069, partial)
`TestRunDetailView` now exposes an "Edit Cases" button (gated on `canManageTests`, matching the backend's `_TESTER` tuple on `PUT /test-runs/{run_id}/cases`) that opens `EditRunCasesDialog` (`src/components/test-runs/EditRunCasesDialog.vue`). The dialog wraps the existing `TestSuiteTreeSelector` — the same component used by the create wizard — pre-selected to the run's current cases (sourced from `testResultsStore.runCases`). Save calls a new `setRunCases(runId, caseIds)` API wrapper and store action (`PUT /test-runs/{run_id}/cases` with `{ test_case_ids: [...] }`, full replace-semantics), then refreshes the run via `fetchRunCasesWithResults` and `fetchProgress`. Added optional `cases_mode: "auto" | "explicit"` to the `TestRun` type to carry the backend's mode-flip signal (first explicit PUT flips `auto` → `explicit`). The wizard-side "skip and create empty" flow from plan-069 is not implemented in this batch — it depends on API plan 034 semantics for the empty-list create case.

### Edit test run metadata from the detail page (plan-067)
`TestRunDetailView` now has an "Edit Run" button (gated on `canManageTests` — tester/lead/admin, matching the backend's `_TESTER` tuple on `PUT /test-runs/{run_id}`) that opens a new `EditTestRunDialog` (`src/components/test-runs/EditTestRunDialog.vue`). The dialog pre-fills name, environment, browser, and build number from the current run, and submits a diff-only patch via `testRunsStore.updateTestRun` → existing `updateTestRun` API wrapper → `PUT /test-runs/{run_id}`. Unchanged fields are omitted from the payload; `config` is only included when at least one config subfield changed. Save is disabled when the name is empty/whitespace or when nothing has changed. Status transitions are intentionally excluded from this dialog — `closeTestRun` and the execute flow remain the only paths that change run status.

---

## 2026-03-23

### Debounce filter events in FilterPanel, not in stores or views
The `filter` event in `FilterPanel.vue` is debounced 300ms via `lodash-es/debounce`. `update:modelValue` remains immediate for responsive UI. Centralising the debounce in the component means all current and future consumers benefit without per-view changes.

### 401 refresh deduplication via shared module-level promise
`api/client.ts` now uses a single `refreshPromise` variable at module scope. Concurrent 401s chain onto the same in-flight refresh rather than each firing a new one. The promise is reset in `.finally()` to prevent a stuck lock on refresh failure.

### Exec-plans lifecycle: templates → active → completed
Execution plans are created in `docs/04-execution/exec-plans/active/`, kept there during implementation with checkboxes updated live, and moved to `completed/` when all Definition of Done items pass. This makes in-flight work visible at a glance.

### Feature docs directory established at docs/01-product/features/
One `.md` file per product feature describes what it does, who can use it, key behaviours, and constraints. Must be created or updated as part of every execution plan. Replaces ad-hoc feature knowledge scattered across architecture and product docs.

### Standard five-phase work cycle formalised in CLAUDE.md
Orient → Plan → Execute → Quality check → Update docs. Every session starts at Phase 1 (check active plans + tech debt). Phases 4 and 5 are mandatory before a plan is considered complete. Documented in `CLAUDE.md`, `AGENTS.md`, and `DOCS_GUIDE.md`.

---

## 2026-03-24

### CI/CD split: `ci.yml` + `cd.yml` replaces monolithic `ci-cd.yml`
CI runs on every push and PR; CD runs only after CI passes on `main` via `workflow_run`. Rationale: PR validation requires CI to run before merge; CD must never run on PRs. Keeping separate files avoids `if:` guards on every step and makes intent obvious. Also fixed: Docker layer caching via GHCR buildcache, GH_PAT credential helper (token never in URL), `concurrency: cancel-in-progress: false` on deploy, post-deploy health check.

---

## 2026-03-25

## 2026-04-06

### Removed mock layer — all API calls go to real backend
Deleted `src/mock/` directory, removed `MOCK_ENABLED` guards from all API files, removed localStorage fallback/merge patterns from stores. Stores now set `error` and re-throw on API failures instead of silently falling back to stale data. Unit tests mock API functions directly with `vi.mock()`.

### Added admin user management (plan-018)
New `src/api/users.ts`, `src/stores/users.ts`, `src/views/users/`, `src/components/users/UserForm.vue`. Routes `/users` and `/users/:id` with admin-only visibility in sidebar.

---

### Unified pipeline: `pipeline.yml` replaces `ci.yml` + `cd.yml`, adds manual approval gate
`ci.yml` and `cd.yml` (linked via `workflow_run`) were merged into a single `pipeline.yml`. Job ordering is expressed with `needs:` within one file, eliminating `workflow_run` cross-file trigger complexity. A new `approve` job (environment: `production-gate`) gates CD after CI passes on `main`; CD jobs carry `if: github.ref == 'refs/heads/main'` so PRs only run CI. The `production-gate` GitHub environment must have required reviewers configured in repo settings — execution pauses there until a human approves in the Actions UI.

---

## 2026-04-20

### Run detail + execute list rendered as nested suite tree (ad-hoc)
Both `/test-runs/:id` and `/test-runs/:id/execute` now render their case / result lists as a **recursive suite subsection tree** instead of a flat list. New `SuiteResultSection.vue` and `SuiteCaseSection.vue` are self-referencing components that build a nested `{ id, name, items, children, totalCount }` tree from `testSuitesStore.suiteTree` + `testResultsStore.runCases`. Branches with no matching cases in their subtree are pruned; any result whose suite isn't in the tree drops into a trailing "Unassigned" bucket. Each section header shows suite name + subtree total count + chevron. Detail-page result cards also display the suite name (📁 + name) as a subtitle; the right-hand detail panel adds a "Suite" tile in the metadata grid.

### Execute page pulls cases from the run, not the project (ad-hoc)
`/test-runs/:id/execute` used to call `testCasesStore.fetchTestCases(projectId)` and render every case in the project. Switched the view to `testResultsStore.fetchRunCasesWithResults(runId)` and exposed a new `runCases: TestCaseWithResult[]` ref on the results store. The execution list now reflects only the cases attached to this run and auto-advance DFS walks that set instead of the full project tree. Removed the now-unused `testCasesStore` import.

### Merged `untested` into `no_run` on the frontend (ad-hoc)
Dropped the `untested` field from `TestRunProgress`. Rationale: two "not run" buckets (tester-chose-no_run vs no-row-exists) were a UX wart carried over from plan-054 — now there's a single `no_run` count. `updateTestRunProgress` normalises any legacy `untested` value coming from the backend by folding it into `no_run`; `syncProgressToTestRun` derives the count as explicit `no_run` rows + `total - results.length`. Removed the "Remaining" chip, the `--status-untested` CSS token, and the `untested` field from tests + fixtures.

### Run metadata moved into the list panel (ad-hoc)
Removed the `run-info-section` stats block from `TestRunDetailView`'s header (Status / Created / Completed / Pass Rate / Progress tiles + status-breakdown chips) and moved the equivalent into `TestResultsList.vue`'s `progress-summary`. The list now owns: a `run-info-bar` tile (Status tag, Created, Completed, highlighted Pass Rate), the segmented `TestRunProgressBar`, a right-aligned `{passed}/{total}` line, and the existing clickable status-count chips. Dates in the list include time. New `testRun?` and `runProgress?` props on `TestResultsList` thread the authoritative data through from the view.

### Empty test runs allowed (ad-hoc)
Removed `validateStep2` on `TestRunCreateView`, so the wizard lets users advance from step 2 (case selection) with zero cases selected. Step 3's review shows an explicit "No cases selected — you can add them from the run detail page" hint. `handleCreate` already sends `include_test_cases: []` in that path, so the backend sees an explicit empty list. (Plan-058 proper adds the later "edit cases" dialog; this is the wizard half only.)

### Defect add/remove refetches run cases + detail view re-syncs selection (ad-hoc)
`addDefectToResult` / `removeDefectFromResult` in the testResults store now call `fetchRunCasesWithResults(currentRunId)` after a successful PATCH so the list + defects tab pick up server truth (e.g. sanitised defect payloads). `TestRunDetailView` watches `testResultsStore.results` and re-points `selectedResult` to the fresh object with the same `test_case_id` after each refetch, otherwise the detail panel kept rendering against the pre-refetch object reference and showed stale history / defects.

### RichTextEditor toolbar visuals unified (ad-hoc)
Every toolbar button now shares the same base (transparent), hover (`--surface-hover` + subtle border), active (primary-100 + primary-coloured border/icon), and disabled (0.4 opacity) styling. Bold / Italic / Strikethrough / Numbered-List buttons were rendering as empty circles because PrimeVue was wrapping their default-slot SVGs in `.p-button-label`; moved those SVGs into the Button's `#icon` slot so they're treated as proper icons and coloured via `currentColor`.

### Blocked verdict button: dark-gray at rest, darker on hover (ad-hoc)
`/test-runs/:id/execute` Blocked button kept falling back to PrimeVue's default colour because the class-level rule lost the specificity race. Switched the button to `severity="secondary"` + `.verdict-btn--blocked`, overrode `--p-button-secondary-*` tokens, and added `!important` fallbacks on `background`/`border-color`/`color`. Base `#1f2937`, hover `#111827`, active `#0b1220`, white text throughout.

### Export dialog Test Run selector full-width (ad-hoc)
`.export-dialog-content :deep(#testRun) { width: 100% }` override on `ReportDashboardView.vue` so the Test Run Select in the PDF/Excel export modal fills the dialog content width (the `class="w-full"` utility isn't shipped by the PrimeVue 4 theme in this project).

### Execute page Save button enables on defect-key change + actually uploads images (plan-065)
Save was disabled unless comment or a new image was present, so a defect-only change could never be saved. Replaced the gate with a `commentPanelIsDirty` computed comparing normalised comment / first-defect key / pending-or-removed images against the persisted result. `saveComment` and `submitResult` now both run a `syncCurrentImages` step after the result save: delete attachments the user removed from the preview, upload new (`!isExisting`) files, then refetch results so `currentImages` rehydrates with server-assigned ids. Partial failures surface via a `warn` toast and failed images stay in the preview for retry.

### Link Defect wired up on test-run detail (plan-064)
`DefectsPanel` emitted `add-defect`/`remove-defect` but `TestResultDetail` never listened — dialog submissions silently no-op'd. Added `addDefectToResult` and `removeDefectFromResult` actions on the `testResults` store (optimistic update + rollback on PATCH failure, dedup by `(tracker, key)`) and wired `TestResultDetail` to dispatch them and toast on error. Dropped the unused `resultId` prop from `DefectsPanel`. Uses the existing `PATCH /test-results/{id}` contract; no new backend endpoints.

### Header avatar initial centered (plan-066)
PrimeVue's default avatar styling left the initial glyph visibly off-center. Added two scoped `:deep()` rules under `.user-section` in `AppHeader.vue` — flex-center the container, neutralise inherited line-height on the inner span — fixing both axes. Global avatar styles untouched to avoid regressing future avatar usages.

### Deduplicated history timeline on test-run detail (plan-063)
`TestResultHistoryPanel` was prepending the current `TestResult` to `props.history` — but history already contains a row for the current state, so every result showed up twice. Rewrote `timelineEvents` to: (a) use `props.history` reversed for newest-first, (b) fall back to a synthetic event from `props.result` only when history is empty, (c) collapse adjacent rows with matching `(status, comment, changed_by)` into one entry with a `×N` badge. Distinct users / comments / statuses stay separate. Render-layer dedupe survives even when legacy backend data still contains redundant rows.

### Step HTML rendering + Execute button hidden on completed runs (plan-062)
`/test-runs/:id/execute` was printing tiptap-authored step HTML as raw angle brackets. Swapped `{{ step.step }}` / `{{ step.expected }}` to `<div class="tiptap-content" v-html>`, matching `/test-cases/:id`. Lifted the `<strong>Action:</strong>` / `<strong>Expected:</strong>` labels above the rich-text blocks so paragraphs/lists render correctly. On `/test-runs/:id`, the Execute Tests button is now gated by a `canExecuteRun` computed: hidden when `run.status ∈ {completed, aborted}`, visible for planned/in_progress. Delete button unchanged (role-only gate). No DOMPurify — no new attack surface vs existing `v-html` sites; sanitisation tracked as tech debt.

### Cases-panel shows every suite, matches aside order (plan-061)
`TestCaseTreeView` was deriving `visibleSuites` from the keys of `testCasesBySuite` and re-sorting alphabetically, so empty suites disappeared and the order disagreed with the aside suite-panel. Replaced with a DFS flatten of `props.suiteTree` (backend order, matches the aside). Empty suites now render via `TestCaseSection`'s existing empty-state, with their default expand state set to collapsed (populated sections stay expanded). During an active search, empty suites still hide.

### Dashboard trend + distribution charts populated (plan-060)
Both charts were rendering blank because `GET /test-runs` doesn't include per-run `progress`. Added `include?: "progress"` to `TestRunFilters` and a dashboard-scoped store action pair (`fetchAllRunsForDashboard`, `fetchRunsForDashboard`) that pass `?include=progress` (api plan 036 opt-in). Doughnut labels now use `statusLabel`, colours come from `RESULT_STATUS_COLORS` (no more hard-coded hex), and `no_run` is included. Empty states render explicit "No completed runs yet" / "No activity yet" copy instead of zero-point placeholders. Non-dashboard call sites retain the cheaper `fetchTestRuns` path.

### Rich text toolbar icons + step actions wrap (plan-059)
PrimeIcons 7 doesn't ship `pi-bold`/`pi-italic`/`pi-strikethrough`/`pi-list-check` — the first toolbar group was rendering blank. Replaced those four buttons with inline SVGs (14×14, `currentColor` so dark mode works for free) and added `aria-label`s. `TestStepsEditor` step header now uses `flex-wrap: wrap` with `margin-left: auto` on the actions, so up/down/duplicate/delete drop to a second row on narrow dialog widths instead of spilling off-edge. No dependency changes.

### Status labels Title-Case across test-run detail page + `StatusBadge` (plan-059)
Added `src/utils/statusLabel.ts` with a single `statusLabel(status)` helper: mapped lookup in `RESULT_STATUS_LABELS`, Title-Case fallback for unknown statuses (`no_run` → `"No Run"`, `retest` → `"Retest"`), em-dash for nullish. Wired into `TestRunDetailView` breakdown, `TestResultsList` filter dropdown and count chips, and the `StatusBadge` `type="result"` branch. Other `StatusBadge` types are unchanged. Filter option `value` stays raw so filtering logic is untouched.

### Pass rate displayed as percent on test-run pages (plan-058)
Backend returns `pass_rate` as a `0..1` ratio (api plan 035). `/test-runs/:id` and `/test-runs/:id/execute` were rendering it as-is, so an 80%-passing run showed `"0.8%"`. Introduced `src/utils/passRate.ts` with `formatPassRate` (×100, `%` suffix, fallback `—` for null) and `toPercent`; scoped use to the three binding sites on those two pages and to `TestResultsList` (which is only rendered by the detail page). `toPercent` keeps a defensive `> 1.5` pass-through during the api plan 035 rollout window. Dashboard and test-run list pages still use inline formatting — tracked as tech debt.

### PDF/Excel summary: test-run field spans full width and wraps (plan-057)
Long run names were clipping at the right page edge in PDF (single `doc.text` without `maxWidth`) and truncating in a narrow Excel column B. PDF now uses `doc.splitTextToSize(..., contentWidth)` via a small `writeWrappedLine` helper, advancing `yPosition` by `lines.length * lineHeight`. Excel merges the value cell across `B:D` with `wrapText: true` and a dynamic row height. Short names keep prior spacing; no-run exports still skip the section.

### Execute page's Blocked button aligned to `--status-blocked` token (plan-057)
The Blocked verdict button on `/test-runs/:id/execute` was rendering as PrimeVue amber (`severity="warning"`) while the badge, progress segment, and exports used dark gray. Replaced the `severity="warning"` with a scoped `.verdict-btn--blocked` class that reads `var(--status-blocked)` so the button colour follows the single source of truth from plan-048. Passed/Failed/No Run still use PrimeVue severities — flagged as tech debt.

### Project switcher redirects project-scoped pages (plan-056)
Chose a single app-level `watch(selectedProjectId)` installed by `useProjectSwitchRedirect` in `DefaultLayout.vue` over per-route guards. Rationale: the trigger is a store mutation (not a navigation), and keeping the redirect table in one pure function (`redirectTargetForSwitch`) makes it trivial to unit-test and easy to extend for new project-scoped routes. Uses `router.replace` (no back-button stale URL) and skips the initial-load tick so deep-links do not redirect on refresh. `beforeRouteLeave` abort reverts `selectedProjectId` so unsaved-changes guards still win.

### Test run detail shows every case, including untouched ones (plan-055)
`TestRunDetailView` now fetches `GET /test-runs/:id/cases` instead of `GET /test-results` and renders a row for every case in the run. Cases without a persisted `TestResult` are **synthesised client-side** with `id: null` and `status: "no_run"` — rather than materialising empty rows server-side, which would bloat the DB and conflate "tester chose no_run" with "never touched". `TestResult.id` widened to `number | null`; submit/update/history call sites guard on `id != null`. Exporters and reports still read the executed-results endpoint; synthetic rows do not leak into them.

### Renamed `skipped` → `no_run`; `no_run` becomes default fallback (plan-054)
The `skipped` status was ambiguous next to the derived `untested` state. Renamed the enum value, CSS token (`--status-skipped` → `--status-no-run`), all progress-bar/stats/export keys, and display label (`"Skipped"` → `"No Run"`). The `suggestOverallStatus` composable now returns `"no_run"` (not `null`) for empty or ambiguous step input, so submitting without a pick records `no_run` rather than a no-op. Coordinated with backend api plan 032 — both ship the literal `"no_run"` on the wire. Color and icon unchanged (`#9ca3af`, `pi pi-minus-circle`).

## 2026-04-17

### Home dashboard: bulk `/projects/stats` replaces the test-cases fan-out (plan-053)
The home `DashboardView` used to call `testRunsStore.fetchAllRuns(projectIds)` + `testCasesStore.fetchAllCases(projectIds)` for every active project just to feed the Overall Pass Rate card, the per-project breakdown, and the metrics headline. `fetchAllCases` transferred every test case payload purely to count them. Added a new backend endpoint `GET /projects/stats` (backend plan-028) returning per-project `total_test_cases`, `total_test_suites`, `total_test_runs`, `active_runs`, and `pass_rate` in one grouped-SQL round-trip. Frontend wiring: new `getProjectStatsBulk` in `src/api/projects.ts`, new `bulkStats`/`fetchBulkStats` on `projectsStore`, and `DashboardView` now derives the metrics cards and the Overall Pass Rate computed (equal-weight average of per-project pass rates, preserved from `aggregatePassRatesByProject`) from `projectsStore.bulkStats`. The `fetchAllCases` call and the `useTestCasesStore` import are gone from the dashboard; runs are still fetched because the trend line, results doughnut, and recent-runs list need row-level data that bulk stats doesn't carry.

### Reports & Analytics: single aggregated endpoint, no client-side fan-out (plan-052)
The Reports dashboard loaded run-level counts by fetching `GET /test-runs/:id/results` **once per run** (around lines 426–428 of `ReportDashboardView.vue`), returning the full result payload — `step_results`, `stack_trace`, `defects` — just to compute status counts and a pass rate. With 20+ runs this was 20+ sequential round-trips. Now a single `GET /projects/:id/report-analytics` call returns the pre-aggregated summary, per-run status counts, priority/type/automation distributions, and the daily trend series. Added `src/stores/reports.ts` (`fetchReportAnalytics`, `clearAnalytics`, `analytics`/`loading`/`error`) and the frontend types `ProjectReportAnalytics`, `RunAnalyticsItem`, `TestCaseDistribution`, `TrendPoint`, `ReportAnalyticsSummary`, `ReportAnalyticsParams` in `src/types/report.ts`. `ReportDashboardView.vue` now drives every chart from `reportsStore.analytics`; the export dialog lazy-loads `testCasesStore.fetchTestCases` and `testRunsStore.fetchTestRuns` only when the user clicks Export (the run-results fetch still fires, but only for the one run the user picks). Date-range changes debounce 200 ms before refetching. Paired with backend `plan-027-reports-analytics-aggregated-endpoint`.

## 2026-04-16

### Bulk create users: format text, refetch, and inline errors (plan-051)
Instruction snippet now shows all five fields without brackets (`username,email,password,full_name,role`) — removes the false impression that `full_name` and `role` are optional. Missing fields trigger a client-side warn toast but still allow submission (backend defaults apply). Dialog stays open on partial success so the user can see and fix failed rows in the inline error panel; users list is refetched on any success so new rows appear immediately. On full failure the dialog stays open with no refetch. Removed the old behavior of closing the dialog on any partial success.

### Dashboard overall pass rate: per-project average + always green (plan-050)
- The headline overall pass rate is now an **equal-weight average of per-project averages** rather than a run-weighted average. Each project contributes one data point regardless of run volume, preventing high-volume projects from skewing the metric.
- `getPassRateColor` threshold-based coloring has been **removed**. The headline is always green via `var(--status-passed)` — the color no longer varies with the numeric value.
- **Zero-run projects** are excluded from the overall average denominator and are displayed as an em-dash in the per-project breakdown.
- A **per-project breakdown list** (capped at 5 rows) is shown beneath the headline; a "View all in Reports" link appears when there are more than 5 projects.
- Logic is encapsulated in the new `composables/usePassRateAggregation` composable (pure function `aggregatePassRatesByProject`), keeping `DashboardView` thin and the aggregation independently testable.

### Removed manual stopwatch from execution view (plan-049)
Deleted the timer widget (clock + play/pause/reset), all backing state (`elapsedSeconds`, `timerInterval`, `executionStartTime`), `startTimer`/`stopTimer`/`resetTimer`/`formatTime` functions, auto-start/reset-on-navigate/stop-on-unmount calls, and all `.timer` CSS. The `execution_time` field is no longer sent in result payloads (`undefined` → backend stores `null`). The backend column and schema field are unchanged — existing values stay, and future automation can write real durations. Reason: the manual timer had no user control over its lifecycle (page open = counting), produced meaningless data, and occupied UI space needed for the per-step status picker.

### Recolor Blocked → dark gray, Skipped → light gray (plan-048)
Blocked changed from `#f59e0b` (amber) to `#4b5563` (Tailwind gray-600, dark gray). Skipped changed from `#6b7280` to `#9ca3af` (Tailwind gray-400, light gray). Reason: amber collided semantically with priority=high and visually with warning states; "blocked" is a halt, not a caution. Updated in all four canonical sources: CSS vars (`variables.css`), TS constants (`RESULT_STATUS_COLORS`), PDF export RGB tuples (`usePdfExport`), Excel export ARGB hex (`useExcelExport`), plus hardcoded refs in `TestRunProgressBar` and `TestRunExecutionView`. The four-source duplication is acknowledged tech debt — a single `status-colors.ts` module would eliminate it.

### Per-step status picker on execution page (plan-047)
- **Store-scoped draft** — `stepResultsDraft: Record<caseId, StepResult[]>` lives in `testResultsStore`, keeping per-step state alongside the rest of the result data and preventing prop-drilling through the execution view.
- **Index-based keying** — `StepResult.index` is the zero-based position in the test case's `steps` array, matching the backend schema directly. No slug or step-ID mapping is needed.
- **Partial coverage valid** — not all steps need to be marked before submitting. The submit payload sends whatever steps are marked; unmarked steps are simply absent from `step_results`.
- **Suggest, not auto** — `suggestOverallStatus` populates the overall status picker but never triggers a submit. The tester retains full control over when and whether the suggestion is accepted.
- **Hydration on revisit** — `hydrateFromResult(result)` is called when an already-submitted result is loaded, restoring any previously saved `step_results` into the draft so re-submissions reflect prior step marks.
- **Standalone `StepStatusPicker` component** — P/F/B/S buttons and collapsible comment textarea are encapsulated in `components/test-runs/StepStatusPicker.vue`, keeping `TestRunExecutionView` thin and the picker independently reusable.
- **Pure `suggestOverallStatus` composable** — `composables/useOverallStatusSuggestion.ts` exports a single pure function with no store dependency, making the suggestion logic unit-testable in isolation.

### Segmented progress bar + backend-authoritative counts (plan-046)
Replaced the single-color PrimeVue `ProgressBar` on both `/test-runs/:id` and `/test-runs/:id/execute` with a custom `TestRunProgressBar` component that renders four proportional segments (Passed=#22c55e, Failed=#ef4444, Blocked=#f59e0b, Skipped=#6b7280) plus an untested tail (surface-200). Segment widths use `total` as the denominator. The last visible segment absorbs rounding error to prevent overflow. Both views now consume `testRunsStore.currentTestRun.progress` (populated by `fetchProgress(runId)` → `GET /test-runs/{id}/progress`) instead of the broken local `testResultsStore.progress` computed, which was deleted. This fixes wrong totals, wrong untested counts, and mismatched pass-rate definitions. Progress is re-fetched after every `submitResult` in the execution view. The existing `updateTestRunProgress` action (WebSocket push path) is unchanged.

### Suite tree selector replaces DataTable for test run case selection (plan-045)
- **New `TestSuiteTreeSelector` component** (`components/test-cases/TestSuiteTreeSelector.vue`) — recursive tree with PrimeVue Checkbox per suite/case row, indeterminate state, and lazy loading. Chose to create a new component rather than mutate the existing `TestSuiteTree`, which serves a different purpose (navigation/browsing, not selection).
- **Selection composable `useSuiteSelection`** (`composables/useSuiteSelection.ts`) — pure functions (`computeSuiteState`, `toggleSuite`, `toggleCase`) with no store dependency, making the propagation logic unit-testable in isolation.
- **Indeterminate via `computeSuiteState`** — derives checked / indeterminate / unchecked per suite by inspecting the flat `Set<number>` of selected case IDs against the suite's full descendant case list.
- **Lazy-load cases per suite into `casesBySuite` cache** — `testCasesStore` gained a `casesBySuite: Map<suiteId, TestCase[]>` cache, `fetchTestCasesBySuite(projectId, suiteId)`, and `clearCasesBySuite()`. Cases are fetched on first suite expansion and not re-fetched on subsequent opens, keeping network traffic proportional to user navigation rather than project size.
- **Filters narrow visibility, not selectability** — active filter state hides non-matching rows from the tree but does not deselect already-checked cases. Propagation helpers receive a `visibleCaseIds` set so suite auto-check only touches visible descendants.
- **`Set<number>` as selection source of truth** — the flat set of case IDs is the canonical selection model. Suite checkboxes are derived state. This keeps the create-run payload simple: `include_test_cases: [...selectedIds]`.

### Test case `automation_id` field on editor + detail page (plan-044)
Added `automation_id?: string | null` to `TestCase`, `TestCaseCreate`, and `TestCaseUpdate` types. Editor shows an `InputText` (maxlength 255, placeholder `e.g. tests/login.spec.ts:42`) after Status, before Tags. Submit coerces empty/whitespace to `null`. Detail page renders the value in the Details card with `word-break: break-all`, or an em dash when empty. Field is shown regardless of case type (manual/automated) — decoupled by design.

### Show test case ID prefix on detail page (plan-043)
`TestCaseDetailView` page header now shows `#<id>` (e.g. `#142`) before the title in `var(--text-color-secondary)` with regular weight. Format is `#<id>` — short, conventional, no misleading prefix like `TC-`. The id span is inline within the `<h1>` to preserve the semantic heading.

### Tag editor: chips below input, debounced backend search, inline create (plan-042)
Reordered the Tags field in `TestCaseEditorView` so the AutoComplete input sits directly under the "Tags" label and the chip strip renders below the input only when tags are present (`v-if="form.selectedTags.length"`). Removed the `min-height: 32px` from `.tags-selected` that was causing a visible gap. Replaced the client-side tag filter with a 250ms debounced call to `tagsStore.searchTags(q)` → `GET /tags?q=`. When no exact match exists, a synthetic `Create "<query>"` option is injected; selecting it calls `tagsStore.createTag` and adds the real tag to the selection.

### MultiSelect tag filter on test case list (plan-042)
Added `MultiSelect` (PrimeVue, `display="chip"`, `filter=true`) to `TestCaseListView` page header. Options come from `tagsStore.fetchTags()` at mount time. Selected tag IDs sync to URL query (`?tag_ids=1&tag_ids=2`) and thread through `testCasesStore.setFilters({ tag_ids })` to the backend. `TestCaseFilters` now includes `tag_ids?: number[]`; Axios serializes arrays as repeated params via `paramsSerializer: { indexes: null }`.

### Tags store: searchResults + in-flight dedup (plan-042)
`stores/tags.ts` now has a `searchResults` ref (transient, separate from the global `tags` list) and a `searchTags` action with a monotonically increasing request ID to discard stale responses. This avoids polluting the full tag list with partial search results and prevents race conditions from fast typing.

---

## 2026-04-13

### User password update: type alignment + tailored toast (plan-041)
`UserUpdate` already carried `password?: string` in `src/types/user.ts`, but `UserDetailView.handleSave` was still declaring its update payload as `Record<string, unknown>` — an intentional escape hatch from an older backend schema mismatch. Switched the local declaration to the typed `UserUpdate`, gated the password field on `.trim().length > 0` (empty or whitespace-only passwords are never sent), and added a distinct success toast ("User updated and password changed successfully") when a password was actually submitted. Plain profile edits keep the previous "User updated successfully" message.

### Dropped "System" theme option (plan-040)
Theme preferences now support only `"light"` and `"dark"`. Removed the `prefers-color-scheme` media query listener from `stores/preferences.ts`, simplified `applyTheme` to a one-liner `setAttribute("data-theme", preferences.value.theme)`, changed the default from `"system"` to `"light"`, and narrowed the `theme` union in `UserPreferences`. `loadPreferences` migrates any legacy `"system"` value persisted in localStorage to `"light"` on load. Removed the System entry from `SettingsView.vue`'s `themeOptions`. Rationale: the auto-switching behaviour could contradict a user's explicit choice and added non-trivial complexity (media listener + branch in `applyTheme`) for a small amount of value; explicit Light/Dark is simpler and more predictable. Updated `tests/unit/stores/preferences.spec.ts` default-theme assertions from `'system'` to `'light'`.

### Password visibility toggle on User form (plan-039)
`UserForm.vue` was using a plain `<InputText type="password">` for both create and edit flows — no way for admins to verify what they typed. Swapped for PrimeVue `<Password>` with `toggleMask` and `:feedback="false"` (same component already in use on `LoginView`, no strength meter needed on an admin form). Added a scoped `.password-field :deep(.p-password-input)` rule so the wrapped input fills the form width like the other fields.

### Rich text preserved in PDF export (plan-038)
`usePdfExport` no longer collapses Tiptap HTML to plain text via `stripHtml` for description, preconditions, and step cells. Added `parseHtmlToBlocks` (converts HTML into `{prefix, words[], bottomGap}` block tokens with per-word `{bold, italic}` flags) and a `renderFormattedHtml` layout helper that walks the blocks and lays out styled runs word-by-word using `doc.setFont("helvetica", "bold"|"italic"|"bolditalic"|"normal")`, wrapping to `maxWidth` and paginating across pages as needed. Used for the description and preconditions sections in the detailed test cases page. Step table cells (`jspdf-autotable` can't carry inline font styles) use a simpler `htmlToFormattedText` converter that preserves structure — `<ul>` → `• ` prefixed lines, `<ol>` → `1. /2. ...`, `<p>` and `<h1..3>` → line breaks, `<br>` → newline. Plain-text content still renders unchanged because `parseHtmlToBlocks` treats text-only input as a single paragraph block. Comments remain `stripHtml`'d — they're short and typically unformatted. Chose inline word-layout over jsPDF's native `html()` method to keep everything synchronous and deterministic with the existing `yPosition` flow; `html()` would have required async mounts and breaks the page-break bookkeeping.

### Title Case status labels on test run detail + execution (plan-036)
`TestRunDetailView` and `TestRunExecutionView` were rendering raw lowercase enum values (`passed`, `planned`, `in_progress`, ...) directly into the template. Imported `RESULT_STATUS_LABELS` from `types/testResult` and used it for the status breakdown chips on the detail page and the status filter `<option>` labels on the execution page. Added a local `RUN_STATUS_LABELS` map for test run statuses (Planned / In Progress / Completed / Aborted) and applied it to both Tag renderings on the detail page. On the execution page, replaced the inline `priority === 'critical' ? 'danger' : ...` severity ladder with the shared `getPrioritySeverity` + `PRIORITY_LABELS` from plan-035. Also fixed the Save button (comments/attachments block) which was rendered as muted `severity="secondary" outlined` — now uses default primary-outlined with `pi-check` icon per the plan-028 convention.

### Priority severity helper centralized + dark-mode checkbox fix (plan-035)
`getPrioritySeverity` was duplicated in three views with divergent key casing — `TestRunCreateView.vue` used `Critical/High/Medium/Low` keys while the backend returns lowercase, so every priority rendered as default `info` blue. Extracted the helper into `src/types/testCase.ts` alongside `PRIORITY_LABELS` / `PRIORITY_COLORS` and imported it in `TestRunCreateView`, `TestCaseEditorView`, and `TestCaseDetailView`. Priority tags on `/test-runs/create` now use `PRIORITY_LABELS` for display (human-readable "Critical" / "High" / "Medium" / "Low") and render distinct colours: critical=red, high=orange, medium=blue, low=green. Also defined the missing `--primary-color-text: #ffffff` variable in both `[data-theme="light"]` and `[data-theme="dark"]` (was referenced in 4 places but never declared) and added an explicit `.p-checkbox .p-checkbox-box.p-highlight .p-checkbox-icon { color: var(--primary-color-text) }` rule so checked checkbox marks are visible in dark mode.

### Project filter badge: readability fix + shared style (plan-034)
`.project-filter-badge` (shown on Dashboard, Reports, Test Runs) was using `var(--primary-100) / var(--primary-700)` which collapses in dark mode and had poor contrast in light mode. Replaced with theme-aware `var(--surface-100)` background, `var(--text-color)` text, and a `var(--surface-300)` border; the folder icon still uses `var(--primary-color)` as an accent. Styles were also duplicated three times across `DashboardView.vue`, `ReportDashboardView.vue`, and `TestRunListView.vue` — extracted to a single global class in `src/assets/styles/main.css` (including the responsive mobile override) and removed from each view's scoped CSS.

### Bottom Save/Cancel buttons + post-save redirect on edit test case (plan-033)
`TestCaseEditorView` now has a duplicate Save Changes + Cancel button pair below the Test Steps card so users editing long test cases don't have to scroll back to the header. `handleSave` sets `hasChanges = false` and `router.push`'s to `/test-cases/:id` on success — the user lands on the read-only detail view (which already has an Edit button) instead of staying in edit mode. Clearing `hasChanges` before navigation prevents the unsaved-changes route guard from firing.

### Edit test case: fix empty-form bug and tags payload (plan-032)
`TestCaseEditorView.onMounted` was only populating the form inside a nested guard (`if (testCasesStore.currentTestCase) { ... if (testSuitesStore.currentSuite) { form.value = ... } }`) — when the suite fetch failed or returned null, every field stayed at its empty default. Restructured so the form is populated immediately after `fetchTestCase` resolves, with the suite and tag library fetches moved into a `try/catch` that just shows a warning toast on failure. Added `normalizeTags` to transparently handle both the current backend shape (`tags: string[]`) and the post-plan-021 shape (`Tag[]`), with placeholder negative IDs resolved against the fetched tag library by name. The update payload now sends `tags: string[]` (names) instead of `tag_ids: number[]` to match the backend's `TestCaseUpdate` schema; `TestCaseUpdate` interface updated to match.

### Rich text (Tiptap) for test case description, preconditions, and steps everywhere (plan-031)
`RichTextEditor` is now used for description and preconditions in the Create Test Case dialog, and for Action / Expected Result in every step of `TestStepsEditor` — matching the edit page. `TestCaseDetailView` renders stored HTML via `v-html` with a new shared `.tiptap-content` class in `main.css` that owns typography for headings, lists, code, blockquotes, and links. `RichTextEditor.vue` now references the same class instead of duplicating the rules in scoped CSS, so the editor and read-only previews render identically. `RichTextEditor.modelValue` was relaxed to `string | undefined` (with `?? ""` fallbacks) so optional fields like `TestCaseCreate.description` bind without type juggling. `v-html` is used without DOMPurify — content is authored by authenticated users behind RBAC, not public input — this is documented in `docs/03-engineering/patterns/component-patterns.md` alongside the new `.tiptap-content` pattern.

### Inline suite creation from Create Test Case dialog (plan-030)
Added a `+` button next to the suite dropdown in the Create Test Case dialog. It reuses the existing "Add Section" dialog and `handleCreateSuite` logic in `TestCaseListView.vue`; an `autoSelectSuiteAfterCreate` flag causes the newly created suite to be auto-assigned to `newTestCase.suite_id` on success. Removes the close-and-reopen friction when the target suite doesn't exist yet. Root-level suite only — nesting is still managed via the tree.

### Test steps editor in Create Test Case dialog (plan-029)
`TestStepsEditor` is now embedded in the Create Test Case dialog in `TestCaseListView.vue`, alongside its existing use on the edit page. Users can define steps at creation time without having to create a placeholder case first and navigate to edit. Dialog width increased to `50rem` and content constrained to `70vh` with overflow scroll so the taller form fits on standard screens. No backend or store changes — `TestCaseCreate` already accepted `steps: TestStep[]`; the create dialog just wasn't exposing the field.

### Button label & style standardization (plan-028)
Documented a single button convention in `docs/03-engineering/patterns/component-patterns.md` and fixed 8 inconsistencies across 7 files: `pi-plus` for create actions (was `pi-check` in several create dialogs), `pi-check` (never `pi-save`) for save/confirm, `text` for cancel/close (not `severity="secondary"`), icons on empty-state CTAs, and `text` modifier on secondary toolbar actions. Also fixed `ProjectDetailView.vue`: renamed "New Suite" → "New Test Suite" and replaced the fake navigation (`goToNewSuite` pushed to `/test-cases`) with an inline `<Dialog>` that calls `testSuitesStore.createTestSuite` directly.

### Removed dead Settings button from project detail header (plan-027)
`ProjectDetailView.vue` had a `<Button label="Settings" icon="pi pi-cog" outlined />` with no click handler and no backing feature. Removed. If project-level settings are ever needed, a future plan will add both backend endpoints and UI together rather than leaving placeholder affordances.

### Delete buttons for Test Cases, Test Suites, Test Runs (plan-026 Phase A)
All six domain entities now have working delete UIs. Test cases get a hover-revealed trash icon per row in `TestCaseSection` plus a header delete button in `TestCaseDetailView`. Test suites get a hover-revealed trash icon both in the `TestSuiteTree` side panel and in the section header. Test runs get a trash action in `TestRunListView` action column and a header delete in `TestRunDetailView`. All deletes go through PrimeVue `useConfirm()` + toast — same pattern as `ProjectListView` / `UserListView`. Cascade language ("this will also delete all results / test cases") is baked into the confirmation messages for suite and run deletes. Role guards: `canManageTests` for all three entity types. Phase B (soft-delete integration) is deferred until backend plan-020 ships — milestone delete is blocked because no milestone list UI exists yet.
