# Execution Plan: Fix Edit Test Case Page — Empty Fields

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-032-fix-edit-test-case-empty-fields.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Fix the test case edit page so all fields (title, description, priority, etc.) are populated from the API response, even when suite or tag fetches fail.

---

## Context

When navigating to `/test-cases/:id/edit`, all form fields are empty despite the test case having data (confirmed via `GET /api/v1/test-cases/6`). The root cause is in `TestCaseEditorView.vue` `onMounted` (lines 140-168): the form is only populated inside a **double-nested guard** — if either `fetchTestCase` or `fetchTestSuite` fails or returns null, the `form.value = { ... }` assignment at line 155 is never reached. All fields stay at their empty defaults from line 50.

A secondary issue is a **tags schema mismatch**: the backend returns `tags: string[]` (names) but the frontend `TestCase` type expects `Tag[]` (objects with `id` and `name`). This breaks tag display and the update payload. The backend fix is in API Plan 021 (`TestCaseResponse.tags` → `list[TagResponse]`). This plan fixes the frontend side.

**Depends on**: API Plan 021 (tags response as objects) for full tag functionality. The form population fix is independent and can ship first.

---

## Scope

### In scope

- **Bug fix**: Restructure `onMounted` so the form is populated immediately after fetching the test case, before fetching suites/tags
- **Resilience**: Suite and tag fetches should not block form population — wrap in try/catch so the form loads even if secondary fetches fail
- **Tags update fix**: Change the update payload to send `tags: string[]` (names) instead of `tag_ids: number[]` to match the backend's `TestCaseUpdate` schema
- **Tags display fix**: Handle the current backend response (`string[]`) and the future response (`TagResponse[]`) gracefully during the transition period

### Out of scope

- Backend schema changes (covered by API Plan 021)
- Adding new fields to the edit form
- Changing the edit page layout

---

## Technical approach

### Bug 1: Form population trapped behind async guards

**Current code** (simplified):
```ts
onMounted(async () => {
  await testCasesStore.fetchTestCase(testCaseId);
  if (testCasesStore.currentTestCase) {
    const tc = testCasesStore.currentTestCase;
    await testSuitesStore.fetchTestSuite(tc.suite_id);     // ← if this fails...
    if (testSuitesStore.currentSuite) {                     // ← ...this is false
      await Promise.all([fetchSuites, fetchTags]);
      form.value = { ... };                                 // ← NEVER REACHED
    }
  }
});
```

**Fix**: Populate the form immediately after fetching the test case. Fetch suites and tags separately for dropdowns — their failure should not block the form:

```ts
onMounted(async () => {
  await testCasesStore.fetchTestCase(testCaseId);
  const tc = testCasesStore.currentTestCase;
  if (!tc) return;

  // Populate form IMMEDIATELY with the fetched data
  form.value = {
    title: tc.title,
    description: tc.description || "",
    preconditions: tc.preconditions || "",
    priority: tc.priority,
    type: tc.type,
    status: tc.status || "active",
    steps: tc.steps.map((s) => ({ ...s })),
    suite_id: tc.suite_id,
    selectedTags: normalizeTags(tc.tags),
  };
  originalForm.value = JSON.parse(JSON.stringify(form.value));

  // Fetch suites + tags for dropdowns (non-blocking for form)
  try {
    await testSuitesStore.fetchTestSuite(tc.suite_id);
    if (testSuitesStore.currentSuite) {
      await Promise.all([
        testSuitesStore.fetchTestSuites(testSuitesStore.currentSuite.project_id),
        tagsStore.fetchTags(),
      ]);
    }
  } catch {
    // Suite/tag dropdown may be empty, but form fields are populated
    toast.add({
      severity: "warn",
      summary: "Warning",
      detail: "Could not load suites or tags. Some dropdowns may be empty.",
      life: 5000,
    });
  }
});
```

### Bug 2: Tags schema mismatch

Add a `normalizeTags` helper to handle both current (string[]) and future (Tag[]) backend responses:

```ts
function normalizeTags(tags: unknown): TagType[] {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  if (typeof tags[0] === "string") {
    // Backend currently returns string[] — map to Tag-like objects
    // IDs are unavailable; use name-based matching against tagsStore after fetch
    return tags.map((name: string, i: number) => ({ id: -(i + 1), name }));
  }
  // Backend returns Tag[] (after API Plan 021)
  return tags.map((t: TagType) => ({ ...t }));
}
```

After `tagsStore.fetchTags()` completes, resolve the placeholder IDs:

```ts
// After tags are fetched, resolve real IDs
if (form.value.selectedTags.some((t) => t.id < 0)) {
  form.value.selectedTags = form.value.selectedTags.map((t) => {
    if (t.id < 0) {
      const real = tagsStore.tags.find((rt) => rt.name === t.name);
      return real ? { ...real } : t;
    }
    return t;
  });
  originalForm.value = JSON.parse(JSON.stringify(form.value));
}
```

### Bug 3: Update payload sends wrong field

**Current** (line 207):
```ts
tag_ids: form.value.selectedTags.map((t) => t.id),
```

**Fix**: Send tag names to match backend `TestCaseUpdate.tags: list[str]`:
```ts
tags: form.value.selectedTags.map((t) => t.name),
```

Also update the `TestCaseUpdate` TypeScript interface to match:
```ts
// In types/testCase.ts
export interface TestCaseUpdate {
  // ...
  tags?: string[];  // was tag_ids?: number[]
}
```

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-cases/TestCaseEditorView.vue` | Restructure `onMounted` to populate form before suite/tag fetch; add `normalizeTags`; fix update payload (`tags` instead of `tag_ids`); add error handling for secondary fetches |
| types | `src/types/testCase.ts` | Change `TestCaseUpdate.tag_ids` to `tags: string[]` |

### Key decisions

- **Populate form first, fetch dropdowns second**: The form should always show the data the user created. Dropdown population is a UX enhancement, not a prerequisite.
- **Graceful degradation**: If suite/tag fetch fails, show a warning toast but keep the form usable. The user can still edit title, description, steps, etc.
- **`normalizeTags` handles both formats**: Enables deployment before and after API Plan 021 without breaking.
- **Send tag names, not IDs**: Matches the backend's `_resolve_tags` pattern which creates-or-finds tags by name.

---

## Tasks

### Implementation

- [x] Restructure `onMounted` in `TestCaseEditorView.vue`: populate form immediately after `fetchTestCase`, before suite/tag fetches
- [x] Wrap suite/tag fetch in try/catch with warning toast on failure
- [x] Add `normalizeTags` helper to handle `string[]` → `Tag[]` mapping
- [x] After tags are fetched, resolve placeholder IDs against `tagsStore.tags`
- [x] Change update payload from `tag_ids: number[]` to `tags: string[]` (tag names)
- [x] Update `TestCaseUpdate` interface in `src/types/testCase.ts`: `tag_ids` → `tags: string[]`
- [x] Test: create test case with data → navigate to edit → verify all fields populated
- [x] Test: edit page loads even when suite fetch fails (fields still populated, warning shown)
- [x] Test: save with tags → verify tags persist correctly

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/06-generated/api-schema.md` — update `TestCaseUpdate` to show `tags` field
- [x] `docs/08-decisions/changelog.md` — note form population restructuring and tags field fix
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tag name collisions (two tags same name, different ID) | Very Low | Backend enforces unique tag names — not possible |
| Suite dropdown empty if suite fetch fails | Medium | User sees warning toast; can still edit all other fields; suite_id is already set from the test case data |
| Deploying frontend before API Plan 021 | Low | `normalizeTags` handles both `string[]` and `Tag[]` formats gracefully |

---

## Definition of done

- [x] Edit page shows all fields populated (title, description, preconditions, priority, type, status, steps, suite, tags)
- [x] Edit page loads successfully even if suite/tag secondary fetches fail
- [x] Tags display correctly and can be added/removed
- [x] Saving with tags persists them correctly (verified via API response)
- [x] No regression on create flow
- [x] All quality checks pass (lint, test, build)
