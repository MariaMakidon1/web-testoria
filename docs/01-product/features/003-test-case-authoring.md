# Feature: Test Case Authoring

## What it does

Test Case Authoring covers the full lifecycle of creating and editing TestCases — the reusable test specifications that form the foundation of Testoria. Each test case has a title, rich-text description and preconditions (via Tiptap editor), an ordered list of test steps (each with an action and expected result), metadata (priority, type, status, tags), and is assigned to a test suite.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Create, edit, delete any test case |
| **Lead** | Create, edit, delete test cases in their projects |
| **Tester** | Create, edit, and delete test cases (`canManageTests` flag) |
| **Read Only** | Read-only — view detail only |

## Key behaviours

- A TestCase belongs to exactly one TestSuite (and transitively to one Project).
- **Rich text fields** (description, preconditions) use Tiptap 3 via `RichTextEditor.vue` — content is stored as HTML. The same editor is used in the Create Test Case dialog, the edit page, and the Action / Expected Result fields of each test step. `TestCaseDetailView` renders the stored HTML via `v-html` with the shared `.tiptap-content` class (defined in `src/assets/styles/main.css`), so the read-only preview matches the editor exactly.
- **Test steps** are an ordered array managed by `TestStepsEditor.vue`; each step has `step` (HTML) and `expected` (HTML) fields. Steps can be reordered via drag-and-drop. The same editor is embedded in **both** the "Create Test Case" dialog (`TestCaseListView.vue`) and the `TestCaseEditorView` edit page — steps are optional at creation time but definable without a second navigation.
- **Priority**: `critical`, `high`, `medium`, `low`. Rendered as a PrimeVue `<Tag :value="PRIORITY_LABELS[priority]" :severity="getPrioritySeverity(priority)">` on every surface — list (`TestCaseSection.vue`), detail (`TestCaseDetailView.vue`), editor (`TestCaseEditorView.vue`), wizard (`TestRunCreateView.vue`), execute (`TestRunExecutionView.vue`), tree selector (`TestSuiteTreeSelector.vue`). `getPrioritySeverity` is the single source of truth for hue mapping (`critical`→`danger`, `high`→`warning`, `medium`→`info`, `low`→`success`) and `PRIORITY_LABELS` for Title-cased copy. Plan-095 (TES-81) removed the legacy `PRIORITY_COLORS` hex map that was driving a divergent yellow `medium` badge in the list view.
- **Type**: `manual`, `automated`
- **Status**: `draft`, `active`, `deprecated`
- **Automation ID**: optional free-form string (`automation_id`, max 255 chars) linking the case to an external automation artifact (e.g. Playwright spec path, pytest node id). Shown on the editor (after Status, before Tags) and the detail page Details card. Empty strings are coerced to `null` on submit. Displayed regardless of whether the case type is `manual` or `automated`.
- **Tags**: array of `Tag` objects (`{ id, name }`). On **create**, tags are linked by id via `tag_ids: number[]`. On **update**, tags are sent as `tags: string[]` (names) — the backend's `_resolve_tags` finds-or-creates by name. Tags are global (not project-scoped). The tag input on the edit page uses a debounced (250ms) backend search via `GET /tags?q=` — results appear in the AutoComplete dropdown. When the typed query has no exact match, a `Create "<query>"` option appears; selecting it calls `POST /tags` to create the tag inline and adds it to the case. Selected tags render as removable chips below the input (the chip strip only renders when tags are present — no empty gap).
- **Tag filter on list view**: `TestCaseListView` includes a `MultiSelect` (PrimeVue, `display="chip"`) in the page header that filters test cases by `tag_ids`. Tag options are prefetched via `tagsStore.fetchTags()` on mount. Selected tag IDs are synced to the URL query string as `?tag_ids=1&tag_ids=2` and threaded through `testCasesStore.setFilters({ tag_ids })` to the backend `GET /test-cases?tag_ids=` endpoint.
- The edit page populates all form fields as soon as the test case fetch resolves — suite and tag dropdown fetches happen afterward inside a `try/catch`. If those secondary fetches fail the form still renders and stays editable; a warning toast tells the user the dropdowns may be empty. `normalizeTags` handles both current backend behaviour (`string[]`) and the post-plan-021 shape (`Tag[]`), assigning negative placeholder IDs that are later resolved against the tag library by name.
- `TestCaseEditorView` handles both create (no `:id`) and edit (with `:id`) modes. The edit page carries duplicate Save Changes / Cancel buttons at the top and bottom; after a successful save the user is redirected to the read-only `TestCaseDetailView`.
- **Inline suite creation**: the Create Test Case dialog has a `+` button next to the suite dropdown (visible to `isProjectManager`). It opens the same "Add Section" dialog used by the tree view, and on successful creation auto-selects the new suite in the test case form via an `autoSelectSuiteAfterCreate` flag — no need to close and reopen the create flow.
- `TestCaseListView` shows cases scoped to a project/suite with filtering, sorting, and pagination.
- `TestCasesIndexView` shows a cross-project flat list of all cases the user can access.
- `TestCaseDetailView` is the read-only detail page with tabs for steps, history, and linked runs. The page header shows `#<id>` before the title in a muted style so users can quickly reference the case's numeric ID.
- Bulk operations (delete, move to suite, export) are available via `BulkActionsBar` + `useBulkOperations`.
- **Single-case delete**: a hover-revealed trash icon appears on each row in `TestCaseSection.vue`, and a header Delete button is available on `TestCaseDetailView.vue`. Both require `canManageTests` and go through a PrimeVue `useConfirm()` flow. Detail view redirects back to the list on success.
- **Drag-and-drop reorder within a section** (plan-093, fixes TES-69): a `canManageTests` user can drag a case row above or below another case **in the same section**. Cross-section moves stay out of scope — the existing Edit flow handles those by re-assigning `suite_id`. Each `.test-case-row` is `:draggable="canManageTests"`, with HTML5 events routed through `src/composables/useTreeDnd.ts`. A 2px primary indicator paints on the row edge to mark the drop slot. On drop, gap-based math (`floor((prev.display_order + next.display_order) / 2)`, edges use `±REORDER_GAP`) yields the new `display_order`, persisted via `PUT /test-cases/{id}` carrying only that field. The store reorders optimistically across all cached lists (`casesBySuite[suiteId]`, `testCases`, `allCases[projectId]`) and reverts every list together on PUT failure. Per-section sort is `(display_order NULLS LAST, id)` — matches the backend's `apply_case_order`.

## Constraints / edge cases

- A TestCase is a **specification**, not an execution record — it has no result status. Results live in TestResult.
- A test case can belong to multiple TestRuns (each execution creates a separate TestResult).
- Deleting a test case does **not** delete historical TestResults — they become orphaned but are preserved.
- Rich text content is sanitised before rendering in read-only views to prevent XSS.
- The editor view fetches the existing case on mount for edit mode; navigating away without saving prompts a confirmation guard.

## Related docs

- `docs/06-generated/api-schema.md` — `testCases` API endpoints
- `docs/06-generated/routes-map.md` — `/test-cases`, `/test-cases/:id`, `/test-cases/:id/edit`
- `src/stores/testCases.ts`
- `src/api/testCases.ts`
- `src/views/test-cases/TestCaseEditorView.vue`, `TestCaseDetailView.vue`, `TestCaseListView.vue`
- `src/components/test-cases/TestStepsEditor.vue`
- `src/components/common/RichTextEditor.vue`
