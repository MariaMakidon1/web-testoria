# Component Patterns

Patterns used for building views and components in Testoria.

---

## View pattern (thin shell)

Views in `src/views/` are intentionally thin. They:
1. Call store actions to load data
2. Bind store state to components
3. Delegate all UI to components

```vue
<!-- TestCaseListView.vue — archetypal view -->
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTestCasesStore } from '@/stores/testCases'
import TestCaseSection from '@/components/test-cases/TestCaseSection.vue'

const route = useRoute()
const store = useTestCasesStore()
const { items, loading, error } = storeToRefs(store)

const projectId = computed(() => Number(route.params.projectId))

onMounted(() => store.fetchTestCases(projectId.value))
</script>

<template>
  <div>
    <TestCaseSection
      :items="items"
      :loading="loading"
      :error="error"
      @refresh="store.fetchTestCases(projectId)"
    />
  </div>
</template>
```

Views never contain business logic — no direct API calls, no complex filtering logic.

---

## List + DataTable pattern

Use `<DataTableWrapper>` for all paginated lists:

```vue
<DataTableWrapper
  :items="items"
  :loading="loading"
  :total="pagination.total"
  :page="pagination.page"
  :page-size="pagination.pageSize"
  @page-change="store.setPage($event)"
>
  <Column field="title" header="Title" sortable />
  <Column field="priority" header="Priority">
    <template #body="{ data }">
      <StatusBadge :status="data.priority" />
    </template>
  </Column>
</DataTableWrapper>
```

`<DataTableWrapper>` automatically handles:
- Loading skeleton (while `loading=true`)
- Empty state (when `items.length === 0` and not loading)
- Pagination via PrimeVue `<Paginator>`

---

## Filter panel pattern

```vue
<FilterPanel @filter="handleFilter" @reset="handleReset">
  <template #fields>
    <div class="filter-row">
      <label>Priority</label>
      <Select v-model="filters.priority" :options="PRIORITIES" placeholder="Any" />
    </div>
    <div class="filter-row">
      <label>Search</label>
      <InputText v-model="filters.search" placeholder="Search..." />
    </div>
  </template>
</FilterPanel>
```

`<FilterPanel>` provides the collapsible wrapper, apply/reset buttons, and emits. The filter state lives in the store.

---

## Confirm before destructive action

Use `<ConfirmDialog>` (not `window.confirm`):

```vue
<ConfirmDialog
  v-model:visible="confirmVisible"
  title="Delete Test Case"
  :message="`Delete '${selectedItem?.title}'? This cannot be undone.`"
  confirm-label="Delete"
  confirm-severity="danger"
  @confirm="handleDelete"
/>
```

Trigger by setting `confirmVisible.value = true` before the delete action.

---

## Empty states

```vue
<EmptyState
  icon="pi pi-list"
  title="No test cases yet"
  description="Create your first test case to get started."
  action-label="New Test Case"
  @action="router.push({ name: 'TestCaseEdit' })"
/>
```

Show `<EmptyState>` when a list has loaded (not loading, no error) but is empty.

---

## Status badge pattern

```vue
<StatusBadge :status="testCase.priority" />
<StatusBadge :status="result.status" />
<StatusBadge :status="testRun.status" />
```

`<StatusBadge>` handles color mapping for all status/priority enums automatically.

---

## Component communication

- **Parent → Child**: props (one-way data flow)
- **Child → Parent**: `defineEmits` + `emit('event', payload)`
- **Sibling / cross-tree**: via store (never event bus)
- **Deep prop drilling (3+ levels)**: refactor to use a store or `provide`/`inject` if truly local

---

## Props and emits declaration

```ts
// TypeScript generics style — preferred
const props = defineProps<{
  items: TestCase[]
  loading?: boolean
  projectId: number
}>()

const emit = defineEmits<{
  refresh: []
  select: [item: TestCase]
  delete: [id: number]
}>()
```

No runtime props declarations (`PropType`) — use TypeScript generics only.

---

## Template `v-if` + `v-for` on the same level

Never put both on the same element. Use `<template>` as wrapper:

```vue
<!-- Wrong -->
<li v-for="item in items" v-if="item.visible" :key="item.id">

<!-- Correct -->
<template v-for="item in items" :key="item.id">
  <li v-if="item.visible">{{ item.title }}</li>
</template>
```

---

## Rich text content styles

Tiptap HTML produced by `RichTextEditor.vue` is rendered in two places: inside the editor itself, and in read-only views via `v-html`. To keep both identical, the typographic styles for Tiptap output live in **one** global class — `.tiptap-content` — in `src/assets/styles/main.css`.

**Rules:**
- Any view that renders stored rich text must wrap the `v-html` target in `<div class="tiptap-content">`. Example: `<div class="tiptap-content" v-html="currentTestCase.description"></div>`.
- Never duplicate heading/list/code/blockquote styles in view-scoped CSS — add them to `.tiptap-content` in `main.css` instead so editor and preview stay in sync.
- `RichTextEditor.vue` applies `.tiptap-content` to its `EditorContent` wrapper; its scoped CSS only contains editor chrome (toolbar, placeholder, outline reset), not typography.
- `v-html` is used without DOMPurify. Rich text fields are authored only by authenticated users behind RBAC; no public input reaches them. Sanitization can be added as a hardening layer later if that changes.

---

## Button convention

All `<Button>` usages across the app follow this table. New buttons should match — no local variations.

| Button type | Style modifiers | Icon | Example |
|-------------|----------------|------|---------|
| **Create / Add** (primary) | default severity | `pi pi-plus` | `<Button label="Create Project" icon="pi pi-plus" />` |
| **Save / Update / Apply** | default severity | `pi pi-check` | `<Button label="Save Changes" icon="pi pi-check" />` |
| **Destructive** (Delete — inline row) | `severity="danger" text rounded` | `pi pi-trash` | `<Button icon="pi pi-trash" severity="danger" text rounded />` |
| **Destructive** (Delete — header / toolbar) | `severity="danger" outlined` | `pi pi-trash` | `<Button label="Delete" icon="pi pi-trash" severity="danger" outlined />` |
| **Cancel / Close / Dismiss** | `text` (no severity) | none | `<Button label="Cancel" text />` |
| **Back / Navigation** | `text` | `pi pi-arrow-left` | `<Button label="Back" icon="pi pi-arrow-left" text />` |
| **Secondary action** (Export, Bulk) | `severity="secondary" text` | contextual | `<Button label="Export CSV" icon="pi pi-download" severity="secondary" text />` |
| **Empty-state CTA** | default severity | `pi pi-plus` | `<Button label="Create your first project" icon="pi pi-plus" />` |

**Rules:**
- `pi-plus` for *create / add* actions, `pi-check` for *save / confirm-existing* actions. Never use `pi-save` — it's legacy.
- Cancel and Close buttons never carry a `severity`. `text` on its own renders them as muted tertiary actions, which is what we want.
- Empty-state CTAs are primary actions, not plain links — always give them an icon.
- Inline row delete icons use `text rounded severity="danger"`; header/toolbar delete buttons use `outlined severity="danger"` with a visible label.
