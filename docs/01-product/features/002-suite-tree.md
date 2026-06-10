# Feature: Suite Tree

## What it does

The Suite Tree provides a hierarchical navigator for organising test cases into logical groupings called TestSuites (think of them as folders). The tree is rendered in the application sidebar and updates reactively as suites are created, renamed, or deleted. Selecting a suite scopes the test case list to that suite and its descendants.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Full CRUD on suites in any project |
| **Lead** | Create, rename, move, delete suites within their projects |
| **Tester** | Navigate the tree and delete suites (`canManageTests`); cannot create or rename |
| **Read Only** | Navigate the tree read-only |

## Key behaviours

- Suites form a tree: a suite can have a `parent_id` pointing to another suite in the same project.
- The tree is loaded per project — switching projects reloads the suite tree.
- `TestSuiteTree.vue` renders the nested structure using recursive rendering; `AppSidebar.vue` hosts it.
- Clicking a suite node routes to `/projects/:projectId/test-cases?suiteId=<id>`, filtering the case list.
- **Parent-level scope on selection** (`TestCaseTreeView.vue`, plan-075): selecting a **child** suite on `/projects/:projectId/test-cases` expands the right-hand case panel to the **parent suite plus all of the parent's descendants** (selected suite + siblings + their subtrees). Top-level suite selection behaves as before (own subtree only). The left-tree highlight stays on the user-clicked suite — only the right-panel scope promotes. Implemented via `getParentSuiteId` + `effectiveScopeSuiteId` feeding the existing `filteredTestCases` id-set logic.
- Creating a suite requires a name; the parent is optional (root suites have no parent).
- Root-level suites can be created from two entry points: the "New Test Suite" button on `ProjectDetailView` (inline dialog) and the `TestCaseListView` tree header — a **labelled `Add Section` button** (plan-094, fixes TES-73). Both go through `testSuitesStore.createTestSuite`.
- **Empty-state CTAs adapt to project shape** (plan-094, fixes TES-73): when a project has zero suites, the cases-panel empty state shows `Add Section` as the primary CTA (`[data-testid="empty-add-section-btn"]`) and a disabled `Add Test Case` as the secondary with a tooltip explaining "Create a section first". When suites exist but no cases, the primary flips to `Add Test Case` (`[data-testid="empty-add-case-btn"]`) and `Add Section` becomes secondary. The previous empty state offered only `Add Test Case`, which led to an unfillable create dialog when no suite existed to attach a case to.
- **Section-action affordances are PrimeVue Buttons, not text links** (plan-094, fixes TES-73): the bottom row of every expanded section renders `Add Case` and `Add Subsection` as `<Button text size="small">` (`[data-testid="section-add-case-btn"]`, `[data-testid="section-add-subsection-btn"]`) so the actions read with the same visual weight as every other create CTA in the app rather than as fine-print links.
- Deleting a suite with children cascades — all descendant suites and their test cases are deleted. The confirmation message warns about this explicitly.
- Delete is triggered by a hover-revealed trash icon on each tree node in `TestSuiteTree.vue` (side panel) and on each section header in `TestCaseSection.vue`. Both go through PrimeVue `useConfirm()` + toast; `canManageTests` role guard.
- The sidebar suite tree is collapsible; collapsed state is persisted in `stores/ui`.
- **Drag-and-drop reorder among siblings** (plan-093, fixes TES-69): a `canManageTests` user can drag a section above or below another **top-level** section, or a subsection above or below a sibling subsection sharing the same parent. Cross-parent drops are rejected silently — the existing Edit dialog covers re-parenting. Each row is `:draggable="canManageTests"`; HTML5-native events mirror `TestStepsEditor.vue`'s working pattern, wired via `src/composables/useTreeDnd.ts`. A 2px primary-coloured indicator paints on the row's top or bottom edge to show the drop slot. On drop, the FE computes a gap-based `display_order = floor((prev.display_order + next.display_order) / 2)` (or `±REORDER_GAP` at the edges) and PUTs only the moved suite's new `display_order`. The local tree is reordered optimistically and reverted on failure with an error toast. Sibling sort is `(display_order NULLS LAST, name)` — matches the backend's `apply_suite_order`.

## Constraints / edge cases

- Suite names must be unique within the same parent (sibling uniqueness); the backend enforces this.
- Circular parent references are not possible through the UI; the backend also rejects re-parenting a suite to one of its own descendants (api plan-046).
- Moving a suite to a different parent is a `updateTestSuite` call with a new `parent_id`; deep-move is a single API call, not a recursive operation.
- The tree fetch (`getTestSuites(projectId)`) returns the full flat list; the frontend builds the nested structure from `parent_id` references.
- Very large suite trees (hundreds of nodes) may cause noticeable render time — no virtual scrolling is implemented.

## Related docs

- `docs/06-generated/api-schema.md` — `testSuites` API endpoints
- `src/stores/testSuites.ts` — state management
- `src/api/testSuites.ts` — HTTP boundary
- `src/components/common/AppSidebar.vue`
- `src/components/test-cases/TestSuiteTree.vue`
- `src/components/test-cases/TestCaseTreeView.vue`
