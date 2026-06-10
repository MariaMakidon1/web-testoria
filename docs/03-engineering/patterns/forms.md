# Forms

How forms are built in Testoria.

---

## General approach

Testoria does not use a form library (no Vee-Validate, Formkit, etc.). Forms use:
- Local `reactive` or `ref` for form state
- Inline computed validation or simple guard functions
- PrimeVue input components
- Store actions for submission

---

## Standard form pattern

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { TestCaseCreate } from '@/types/testCase'
import { useTestCasesStore } from '@/stores/testCases'

const store = useTestCasesStore()

const form = reactive<TestCaseCreate>({
  suite_id: props.suiteId,
  title: '',
  description: '',
  steps: [],
  priority: 'medium',
  type: 'manual',
  status: 'draft'
})

const errors = reactive<Partial<Record<keyof TestCaseCreate, string>>>({})
const submitting = ref(false)

function validate(): boolean {
  errors.title = form.title.trim() ? undefined : 'Title is required'
  errors.suite_id = form.suite_id ? undefined : 'Suite is required'
  return !Object.values(errors).some(Boolean)
}

async function submit() {
  if (!validate()) return

  submitting.value = true
  try {
    await store.createTestCase(projectId, form)
    emit('success')
  } catch (e) {
    // store sets store.error; optionally show it here
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="field">
      <label for="title">Title *</label>
      <InputText id="title" v-model="form.title" :class="{ 'p-invalid': errors.title }" />
      <small v-if="errors.title" class="p-error">{{ errors.title }}</small>
    </div>

    <div class="field">
      <label>Priority</label>
      <Select v-model="form.priority" :options="PRIORITIES" />
    </div>

    <div class="field">
      <label>Description</label>
      <RichTextEditor v-model="form.description" placeholder="Describe the test case..." />
    </div>

    <div class="actions">
      <Button type="button" label="Cancel" severity="secondary" @click="emit('cancel')" />
      <Button type="submit" label="Save" :loading="submitting" />
    </div>
  </form>
</template>
```

---

## Test steps editor

Use `<TestStepsEditor>` for the steps array:

```vue
<TestStepsEditor v-model="form.steps" />
```

`form.steps` is `TestStep[]` — `[{ step: string, expected: string }]`. The editor handles add/remove/reorder.

---

## Rich text fields

```vue
<RichTextEditor
  v-model="form.description"
  placeholder="Enter description..."
/>
```

The value is an HTML string (Tiptap output). When displaying, render as `v-html`. When sending to a plain-text context (Excel export), use `stripHtml()`.

---

## Select / dropdown

```vue
<!-- Single select from a constant list -->
<Select
  v-model="form.priority"
  :options="PRIORITIES"
  placeholder="Select priority"
/>

<!-- With object options -->
<Select
  v-model="form.suiteId"
  :options="suites"
  option-label="name"
  option-value="id"
  placeholder="Select suite"
/>
```

Import constants from `src/types/testCase.ts`: `PRIORITIES`, `TEST_CASE_TYPES`, `TEST_CASE_STATUSES`, and the label maps `PRIORITY_LABELS`, `TYPE_LABELS`, `STATUS_LABELS`.

---

## File upload / import

Use `<ImportExportDialog>` for the full import flow (file picker + preview + submit):

```vue
<ImportExportDialog
  v-model:visible="importVisible"
  :format="'csv'"
  :required-fields="['title', 'suite_id']"
  @import="handleImport"
/>
```

For custom import handling, use `useImport<T>()` directly (see `patterns/composables.md`).

---

## Form state reset

```ts
function resetForm() {
  Object.assign(form, {
    title: '',
    description: '',
    steps: [],
    priority: 'Medium',
    // ...
  })
  Object.keys(errors).forEach(key => delete (errors as Record<string, unknown>)[key])
}
```

---

## Submission loading state

Always set a `submitting` ref during async submission. Bind to the button's `:loading` prop:

```vue
<Button type="submit" label="Save" :loading="submitting" :disabled="submitting" />
```

This prevents double-submit and gives visual feedback.
