# Composables

How composables are used in Testoria and what each one provides.

---

## What composables are for

Composables (`src/composables/`) extract reusable logic that:
- Does not need to be a store (not shared between unrelated components)
- Involves reactive state + functions that logically belong together
- Can be used across multiple views or components

Unlike stores, composables are instantiated per-use (each `useFoo()` call gets its own state). Use a store if state must be shared.

---

## `useBulkOperations<T>` — multi-select + bulk actions

```ts
import { useBulkOperations } from '@/composables/useBulkOperations'

const bulk = useBulkOperations<TestCase>({
  operations: [
    {
      id: 'delete',
      label: 'Delete',
      icon: 'pi pi-trash',
      severity: 'danger',
      confirmMessage: (count) => `Delete ${count} test case(s)?`,
      action: async (items) => {
        await Promise.all(items.map(i => store.deleteTestCase(i.id)))
      }
    },
    {
      id: 'move',
      label: 'Move to suite',
      icon: 'pi pi-folder',
      action: async (items) => { /* ... */ }
    }
  ],
  onSuccess: (opId, count) => uiStore.addNotification({ severity: 'success', summary: `Done (${count})` }),
  onError: (opId, err) => uiStore.addNotification({ severity: 'error', summary: err.message })
})

// Returns:
// selectedItems, selectedCount, selectedIds, hasSelection
// processing, currentOperation
// selectItem, deselectItem, toggleItem, selectAll, deselectAll, isSelected
// executeOperation(id), getConfirmMessage(id)
// operations (pass to BulkActionsBar)
```

Bind to table: `<DataTable v-model:selection="bulk.selectedItems.value">`
Bind actions bar: `<BulkActionsBar :bulk="bulk" />`

---

## `useExport` — JSON / CSV / XML

```ts
import { useExport } from '@/composables/useExport'
const { exportData, exportToJson, exportToCsv, exportToXml, exporting, error } = useExport()

// Generic entry point
await exportData(items, { filename: 'test-cases', format: 'csv', fields: ['id', 'title', 'priority'] })

// Direct methods
exportToJson(items, 'test-cases')
exportToCsv(items, 'test-cases', ['id', 'title'], true)
exportToXml(items, 'test-cases', 'testCases', 'testCase')
```

All exports trigger a browser file download. No server call.

---

## `useExcelExport` — styled Excel workbook

```ts
import { useExcelExport } from '@/composables/useExcelExport'
const { exportToExcel, exporting, error } = useExcelExport()

await exportToExcel(
  {
    project: currentProject.value,
    testRun: currentRun.value,          // optional
    testCases: cases.value,
    testResults: results.value
  },
  {
    includeSteps: true,      // default: true
    includeComments: true,   // default: true
    includeMetadata: true    // default: true
  }
)
```

Generates a `.xlsx` with sheets: Summary, Test Cases, Test Steps (optional), Test Results. Uses ExcelJS + file-saver. Filename: `test-report-<PROJECT_KEY>-<date>.xlsx`.

---

## `usePdfExport` — PDF report

```ts
import { usePdfExport } from '@/composables/usePdfExport'
const { exportToPdf, exporting, error } = usePdfExport()

await exportToPdf({ project, testRun, testCases, testResults })
```

Generates a PDF using jsPDF + jspdf-autotable. Triggered as a browser download.

---

## `useImport` — file parsing

```ts
import { useImport } from '@/composables/useImport'
const importer = useImport<TestCaseCreate>()

const result = await importer.importFromFile(file, {
  format: 'csv',                         // or 'json'
  requiredFields: ['title', 'suite_id'],
  validateRow: (row) => Boolean(row.title),
  transformRow: (row) => ({
    title: row.title as string,
    suite_id: Number(row.suite_id),
    priority: (row.priority as string) || 'Medium'
  })
})

// result.success, result.data, result.errors, result.totalRows, result.validRows
if (result.success) {
  // submit result.data to store
}
```

CSV header normalization: spaces → underscores, lowercased. (`"Test Title"` → `test_title`)

---

## `useAccessibility` — keyboard and screen reader support

```ts
import { useAccessibility, useKeyboardShortcuts } from '@/composables/useAccessibility'

// In App.vue or DefaultLayout.vue (once, globally)
const { isKeyboardUser, announce, createFocusTrap, skipToContent, generateId } = useAccessibility()

// Announce dynamic content changes to screen readers
announce('Test case saved successfully')
announce('Error: validation failed', 'assertive')

// Trap focus in a modal
const removeTrap = createFocusTrap(modalElement)
// Call removeTrap() when modal closes

// Keyboard shortcuts (in any component)
useKeyboardShortcuts({
  'ctrl+s': () => save(),
  'escape': () => cancel(),
  'ctrl+shift+n': () => createNew()
})
```

`useKeyboardShortcuts` automatically ignores shortcuts when focus is in an input or textarea.

---

## `useTreeDnd<T>` — native HTML5 drag-and-drop with gap-based ordering

`src/composables/useTreeDnd.ts` (plan-093). Powers drag-to-reorder for siblings in the suite tree (`TestSuiteTree.vue`) and case rows in a section (`TestCaseSection.vue`).

```ts
import { useTreeDnd, computeNewOrder, REORDER_GAP } from '@/composables/useTreeDnd'

const dnd = useTreeDnd<TestCase>({
  items: toRef(props, 'testCases'),       // flat sibling list (current render order)
  scopeKey: (tc) => tc.suite_id,           // drops are rejected across scopes
  onReorder: (id, newDisplayOrder) => {    // fires once per accepted drop
    emit('reorder-case', id, props.suite.id, newDisplayOrder)
  },
})
```

Template wiring on each row:

```html
<div
  :draggable="authStore.canManageTests"
  :class="{
    'is-dragging': dnd.draggedId.value === item.id,
    'drop-indicator-top':    dnd.dropIndicatorFor(item) === 'top',
    'drop-indicator-bottom': dnd.dropIndicatorFor(item) === 'bottom',
  }"
  @dragstart="dnd.onDragStart($event, item)"
  @dragover="dnd.onDragOver($event, item)"
  @dragleave="dnd.onDragLeave(item)"
  @drop="dnd.onDrop($event, item)"
  @dragend="dnd.onDragEnd"
/>
```

Key points:
- `computeNewOrder` is exported separately for unit tests — pure function, no DOM.
- Math is `floor((prev.display_order + next.display_order) / 2)`; edges fall back to `±REORDER_GAP` (1000).
- `scopeKey` enforces same-parent / same-suite drops at the JS layer; the visual cursor (`not-allowed`) only hints — the guard is the contract.
- Recursive components: each instance owns its own DnD scope keyed on its `props.suites` / `props.testCases`. Children mount their own composable; reorder events bubble through `@reorder-suite` / `@reorder-case`.
- Optimistic local reorder + rollback is the store's job (`testSuitesStore.reorderTestSuite`, `testCasesStore.reorderTestCase`). The composable only emits intent.

Cross-parent moves are explicitly out of scope for v1 — covered by the existing Edit flows. Tracked as plan-093 follow-up tech debt.

---

## Writing a new composable

```ts
// src/composables/useMyFeature.ts
import { ref, computed } from 'vue'

export function useMyFeature(options: { ... }) {
  const state = ref(...)
  const derived = computed(() => ...)

  async function doSomething() {
    // ...
  }

  return { state, derived, doSomething }
}
```

Rules:
- File name: `use<Name>.ts`
- Export a single function named `use<Name>()`
- Return an explicit object
- No store imports at module level — import inside functions if needed
- No direct API calls — go through a store or accept a callback
