# Frontend Engineering Guide

Practical guide for developing features in the Testoria frontend.

---

## Setup

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
```

Requires a running backend. Set `VITE_API_URL` in `.env.local` if not using the default (`/api/v1`):
```
# .env.local
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Common tasks

### Fetch and display a list with pagination

1. Store: define `items`, `loading`, `error`, `pagination` refs; add `fetchItems(projectId)` action
2. View: call `store.fetchItems()` in `onMounted`; bind `store.items`, `store.loading`, `store.error` to `<DataTableWrapper>`
3. `<DataTableWrapper>` handles loading skeleton and empty state automatically

### Add a filter

1. Add filter fields to the store's `filters` reactive object
2. Call `fetchItems()` whenever filters change (use a `watch` on filters)
3. Drop `<FilterPanel>` into the view; bind `v-model` to store filters; listen for `@filter` event
4. Optionally wire in `<SavedFiltersDropdown>` for persisted filters

### Add a bulk action

```ts
// In the view's <script setup>
const bulk = useBulkOperations<TestCase>({
  operations: [
    {
      id: 'delete',
      label: 'Delete selected',
      icon: 'pi pi-trash',
      severity: 'danger',
      confirmMessage: (count) => `Delete ${count} test case(s)?`,
      action: async (items) => {
        await Promise.all(items.map(i => store.deleteTestCase(i.id)))
      }
    }
  ],
  onSuccess: (op, count) => uiStore.addNotification({ severity: 'success', summary: `Deleted ${count} items` }),
})
```

Then bind `<BulkActionsBar :bulk="bulk" />` and `<DataTable v-model:selection="bulk.selectedItems.value">`.

### Add a form with a rich text field

Use `<RichTextEditor v-model="form.description" placeholder="..." />`. The value is an HTML string. Strip HTML before sending to a plain-text API field.

### Add a toast notification

```ts
import { useUIStore } from '@/stores/ui'
const uiStore = useUIStore()

uiStore.addNotification({ severity: 'success', summary: 'Saved', life: 3000 })
uiStore.addNotification({ severity: 'error', summary: 'Failed', detail: error.message })
```

### Export to Excel

```ts
import { useExcelExport } from '@/composables/useExcelExport'
const { exportToExcel, exporting } = useExcelExport()

await exportToExcel({
  project: currentProject.value,
  testRun: currentRun.value,
  testCases: cases.value,
  testResults: results.value
})
```

### Export to CSV/JSON/XML (generic)

```ts
import { useExport } from '@/composables/useExport'
const { exportData } = useExport()

await exportData(cases.value, { filename: 'test-cases', format: 'csv' })
```

### Import from file

```ts
import { useImport } from '@/composables/useImport'
const importer = useImport<TestCaseCreate>()

const result = await importer.importFromFile(file, {
  format: 'csv',
  requiredFields: ['title', 'suite_id'],
  transformRow: (row) => ({ title: row.title as string, suite_id: Number(row.suite_id) })
})

if (result.success) {
  // result.data contains the parsed and transformed rows
}
```

---

## Adding a new domain

Checklist (in order):

- [ ] `src/types/<domain>.ts` — interfaces + enums
- [ ] `src/api/<domain>.ts` — CRUD functions using apiClient
- [ ] `src/stores/<domain>.ts` — store using standard pattern
- [ ] `src/views/<domain>/` — view components
- [ ] `src/router/index.ts` — add routes with `requiresAuth: true`
- [ ] `docs/06-generated/routes-map.md` — update
- [ ] `docs/06-generated/api-schema.md` — update

---

## Debugging

- **Auth loops**: clear `access_token` and `refresh_token` from localStorage and reload.
- **Store state**: use Vue DevTools → Pinia tab to inspect store state in real time.
- **Type errors**: run `npm run build` (not just `dev`) — `vue-tsc` catches errors that Vite's dev server may miss.

---

## Scripts reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (vue-tsc + vite) |
| `npm run preview` | Preview production build locally |
| `npm run test` | Vitest unit tests (watch) |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | Playwright e2e |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier format |
