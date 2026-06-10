# Testing Strategy

Testing approach for the Testoria frontend.

---

## Layers

| Layer | Tool | What it tests |
|-------|------|--------------|
| Unit | Vitest + @vue/test-utils | Stores, composables, utility functions, individual components |
| E2E | Playwright | Full user flows in a real browser |

No integration tests — unit tests mock API functions directly via `vi.mock()`.

---

## Philosophy

**Test stores and composables, not implementation details.**

Stores contain the business logic. Components are mostly layout + bindings. Prioritize testing:
1. Store actions (fetch, create, update, delete — including error and loading state)
2. Composables (`useBulkOperations`, `useExport`, `useImport`)
3. Complex components (forms with validation, `<RichTextEditor>` integration)
4. E2E: the critical user paths that must not break

Do not test:
- Simple prop-passing components with no logic
- PrimeVue component internals
- CSS / styling

---

## Mocking in tests

Unit tests mock API functions directly using `vi.mock('@/api/<domain>')`. No backend or HTTP stubs needed. Store tests verify that stores correctly call API functions, handle responses, and propagate errors.

---

## What to write first (priority order)

1. `stores/auth` — login, logout, role flags, token refresh
2. `stores/testCases` — CRUD, pagination, filters, error state
3. `stores/testRuns` — CRUD, status transitions, progress
4. `composables/useBulkOperations` — selection, execute, confirm message
5. `composables/useExport` — CSV/JSON/XML output
6. `composables/useImport` — JSON/CSV parsing, validation, transform
7. E2E: login → create test run → execute → view results
8. E2E: create test case → edit → verify in list

---

## File placement

```
src/
  stores/
    __tests__/
      auth.spec.ts
      testCases.spec.ts
  composables/
    __tests__/
      useBulkOperations.spec.ts
  components/
    common/
      __tests__/
        DataTableWrapper.spec.ts
tests/
  e2e/
    login.spec.ts
    test-run-execution.spec.ts
```

Or co-locate as `auth.store.spec.ts` next to `auth.ts` — both patterns are accepted by Vitest.
