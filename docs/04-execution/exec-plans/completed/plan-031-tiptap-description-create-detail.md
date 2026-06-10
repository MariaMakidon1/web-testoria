# Execution Plan: Tiptap Rich Text for Test Case Description on Create & Detail

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-031-tiptap-description-create-detail.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Use the `RichTextEditor` (Tiptap) for the description and preconditions fields in the test case create dialog, for the test step Action and Expected Result fields in the `TestStepsEditor` component, and render all stored HTML correctly on the test case detail page.

---

## Context

The test case edit page (`TestCaseEditorView.vue`) already uses `RichTextEditor` for both description and preconditions — it emits HTML, which the backend stores in a PostgreSQL `Text` column. However:

1. **Create dialog** (`TestCaseListView.vue`): Uses plain PrimeVue `Textarea` components. If a user creates a test case here then opens the edit page, the content appears as plain text in the rich editor. More importantly, users expect the same editing experience at creation and edit time.

2. **Detail page** (`TestCaseDetailView.vue`): Renders description and preconditions via `{{ value }}` (text interpolation), which displays raw HTML tags as visible text instead of rendering them. Content saved from the edit page (which uses Tiptap) shows as `<p>some <strong>bold</strong> text</p>` literally.

3. **Test steps editor** (`TestStepsEditor.vue`): The Action and Expected Result fields (lines 176-194) use plain `Textarea` components. Users should be able to format step instructions with bold, lists, code, etc. — the same editing experience as description/preconditions.

4. **Detail page test steps** (`TestCaseDetailView.vue` lines 116, 119): Step fields are rendered via `{{ step.step }}` and `{{ step.expected }}` (text interpolation), which will show raw HTML tags if steps contain rich text.

No backend changes are needed — the API already accepts and returns HTML strings in these fields (steps are stored as JSONB with `step` and `expected` string fields, no length constraints).

---

## Scope

### In scope

- Replace `Textarea` with `RichTextEditor` for description and preconditions in the create dialog (`TestCaseListView.vue`)
- Replace `Textarea` with `RichTextEditor` for Action and Expected Result fields in `TestStepsEditor.vue`
- Render description, preconditions, and test step fields as HTML on the detail page (`TestCaseDetailView.vue`) using `v-html` with the shared Tiptap content styles
- Adjust create dialog sizing to accommodate the rich editors
- Apply the same Tiptap content styles to the detail page display so rendered HTML looks identical to the editor preview

### Out of scope

- Adding Tiptap to other entities (project description, milestone description, etc.) — separate plans if needed
- Sanitization library (DOMPurify) — content is authored by authenticated users within the app, not user-generated public input. Can be added later as a hardening measure.
- Backend changes (not needed)

---

## Technical approach

### 1. Create dialog — Replace Textarea with RichTextEditor

In `TestCaseListView.vue`, the description field (lines ~391-397) and preconditions field (lines ~399-409) currently use `<Textarea>`. Replace with:

```vue
<div class="field">
  <label>Description</label>
  <RichTextEditor
    v-model="newTestCase.description"
    placeholder="Enter test case description..."
    minHeight="100px"
  />
</div>

<div class="field">
  <label>Preconditions</label>
  <RichTextEditor
    v-model="newTestCase.preconditions"
    placeholder="Enter preconditions..."
    minHeight="80px"
  />
</div>
```

Import `RichTextEditor` at the top of the `<script setup>` block. Increase dialog width to give the editors room (similar to Plan 029's dialog sizing adjustment for TestStepsEditor).

### 2. Detail page — Render HTML with v-html

In `TestCaseDetailView.vue`, the description (line ~92) and preconditions (line ~100) currently use:

```vue
<p>{{ testCasesStore.currentTestCase.description }}</p>
```

Replace with:

```vue
<div
  v-if="testCasesStore.currentTestCase.description"
  class="tiptap-content"
  v-html="testCasesStore.currentTestCase.description"
></div>
<p v-else class="text-secondary">No description</p>
```

### 3. Tiptap content styles on detail page

The `RichTextEditor.vue` component has scoped styles for rendered Tiptap content (headings, lists, code blocks, links, etc.) inside `.tiptap-editor .ProseMirror`. The detail page needs the same styles for the read-only HTML. Two options:

**Option A (chosen)**: Extract the Tiptap content styles into a shared CSS class `.tiptap-content` in `main.css`. Use this class in both `RichTextEditor.vue` (for the editor preview) and `TestCaseDetailView.vue` (for the read-only display). This avoids duplicating styles.

**Option B**: Duplicate the styles in `TestCaseDetailView.vue` with a scoped class. Simpler but creates drift.

Going with **Option A** — extract once, use everywhere.

### 4. Test steps editor — Replace Textarea with RichTextEditor

In `TestStepsEditor.vue`, the Action field (line 176) and Expected Result field (line 187) use `<Textarea>`. Replace with compact `RichTextEditor`:

```vue
<div class="field">
  <label>Action</label>
  <RichTextEditor
    :modelValue="step.step"
    @update:modelValue="updateStep(index, 'step', $event)"
    placeholder="Describe what action to perform..."
    minHeight="60px"
  />
</div>
<div class="field">
  <label>Expected Result</label>
  <RichTextEditor
    :modelValue="step.expected"
    @update:modelValue="updateStep(index, 'expected', $event)"
    placeholder="Describe the expected outcome..."
    minHeight="60px"
  />
</div>
```

Import `RichTextEditor` and remove the `Textarea` import. Use a smaller `minHeight` (`60px`) since step fields are typically shorter than description/preconditions.

### 5. Detail page test steps — Render HTML with v-html

In `TestCaseDetailView.vue`, step display (lines 116, 119) currently uses:

```vue
<strong>Action:</strong> {{ step.step }}
<strong>Expected:</strong> {{ step.expected }}
```

Replace with:

```vue
<div class="step-action">
  <strong>Action:</strong>
  <div class="tiptap-content" v-html="step.step"></div>
</div>
<div class="step-expected">
  <strong>Expected:</strong>
  <div class="tiptap-content" v-html="step.expected"></div>
</div>
```

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-cases/TestCaseListView.vue` | Replace `Textarea` with `RichTextEditor` for description and preconditions in the create dialog; import component; adjust dialog width |
| views | `src/views/test-cases/TestCaseDetailView.vue` | Replace `{{ }}` with `v-html` + `.tiptap-content` class for description, preconditions, and test step fields |
| styles | `src/assets/styles/main.css` | Extract `.tiptap-content` shared styles (headings, lists, code, links) from `RichTextEditor.vue` |
| components | `src/components/common/RichTextEditor.vue` | Replace duplicated content styles with the shared `.tiptap-content` class |
| components | `src/components/test-cases/TestStepsEditor.vue` | Replace `Textarea` with `RichTextEditor` for Action and Expected Result fields; import component; remove Textarea import |

### Key decisions

- **`v-html` without DOMPurify**: Content is authored by authenticated users behind RBAC. No public-facing user input reaches these fields. Sanitization can be added as a hardening layer later but is not a blocker.
- **Shared `.tiptap-content` class**: Prevents style drift between editor preview and detail page display. Single source of truth for how Tiptap HTML renders.
- **Both description and preconditions get Tiptap**: The edit page already uses Tiptap for both fields. Consistency requires the create dialog and detail page to match.
- **`minHeight` smaller than edit page**: Create dialog has less space. Use `100px` for description and `80px` for preconditions (edit page uses `120px` / `100px`).
- **Compact editors for test steps**: Step fields use `minHeight="60px"` — they're typically one or two lines. The toolbar still provides formatting options, but the editor is shorter to keep the step card compact.
- **No `autoResize` needed**: RichTextEditor handles its own sizing via Tiptap's content area. The removed `Textarea autoResize` behavior is replaced by Tiptap's natural content expansion.

---

## Tasks

### Implementation

- [x] Extract Tiptap content styles from `RichTextEditor.vue` into a shared `.tiptap-content` class in `main.css`
- [x] Update `RichTextEditor.vue` to use the shared `.tiptap-content` class instead of duplicated scoped styles
- [x] Import `RichTextEditor` into `TestCaseListView.vue`
- [x] Replace `Textarea` with `RichTextEditor` for description in the create dialog
- [x] Replace `Textarea` with `RichTextEditor` for preconditions in the create dialog
- [x] Adjust create dialog width to accommodate the rich editors
- [x] Replace `{{ description }}` with `v-html` + `.tiptap-content` class in `TestCaseDetailView.vue`
- [x] Replace `{{ preconditions }}` with `v-html` + `.tiptap-content` class in `TestCaseDetailView.vue`
- [x] Add "No description" / "No preconditions" empty-state text when fields are null or empty
- [x] Import `RichTextEditor` into `TestStepsEditor.vue`, remove `Textarea` import
- [x] Replace `Textarea` with `RichTextEditor` for Action field in `TestStepsEditor.vue` (line 176)
- [x] Replace `Textarea` with `RichTextEditor` for Expected Result field in `TestStepsEditor.vue` (line 187)
- [x] Replace `{{ step.step }}` and `{{ step.expected }}` with `v-html` + `.tiptap-content` class in `TestCaseDetailView.vue` (lines 116, 119)
- [x] Test: create a test case with rich text in steps (bold, lists) → verify it displays correctly on detail page → verify it appears correctly in the edit page

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] Visual spot-check: create dialog, detail page, and edit page all render rich content consistently
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/01-product/features/` — update test case authoring feature doc to note rich text on create and detail
- [x] `docs/03-engineering/patterns/component-patterns.md` — document `.tiptap-content` shared class pattern
- [x] `docs/08-decisions/changelog.md` — note shared content styles decision and v-html without DOMPurify rationale
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Create dialog becomes too tall with two rich editors + steps (Plan 029) | Medium | Set max-height with overflow-y scroll on dialog content; test with all editors open |
| Test step cards become too tall with two rich editors per step | Medium | Use compact `minHeight="60px"`; toolbar collapses when editor is not focused if space is tight |
| Extracting styles from scoped CSS breaks RichTextEditor | Low | Test the editor thoroughly after extraction; use `:deep()` or global class as needed |
| `v-html` XSS from stored HTML | Low | Content authored by authenticated users only; add DOMPurify later as hardening if needed |
| Existing plain-text step content renders differently after this change | Low | Plain text without HTML tags renders fine inside `v-html` — just loses wrapping, which is acceptable |
| Drag-and-drop on step cards may conflict with Tiptap editor focus | Low | Drag handle is separate from content area; test that clicking inside the editor doesn't trigger drag |

---

## Definition of done

- [x] Create dialog uses `RichTextEditor` for description and preconditions (not plain Textarea)
- [x] Test steps editor uses `RichTextEditor` for Action and Expected Result fields (not plain Textarea)
- [x] Detail page renders stored HTML correctly for description, preconditions, and test steps (bold, lists, links, code blocks display as formatted content)
- [x] Detail page and edit page preview render identically for the same content (shared styles)
- [x] Empty description/preconditions show a "No description" / "No preconditions" placeholder
- [x] Create → Detail → Edit round-trip preserves rich text formatting for all fields including steps
- [x] Step card drag-and-drop still works correctly with rich editors
- [x] All quality checks pass (lint, test, build)
