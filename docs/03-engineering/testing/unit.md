# Unit Testing

Vitest + @vue/test-utils setup and patterns for Testoria.

---

## Setup

```bash
npm run test             # watch mode
npm run test:coverage    # coverage report
```

Vitest is configured via `vite.config.ts` (or `vitest.config.ts`). Test environment: `happy-dom` (faster than jsdom).

---

## Testing a Pinia store

```ts
// stores/__tests__/auth.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Clear localStorage between tests
    localStorage.clear()
  })

  it('isAuthenticated is false when no token', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
  })

  it('sets tokens and isAuthenticated=true after login', async () => {
    const store = useAuthStore()
    await store.login({ username: 'admin', password: 'admin' })
    expect(store.isAuthenticated).toBe(true)
    expect(store.user).not.toBeNull()
  })

  it('clears state on logout', async () => {
    const store = useAuthStore()
    await store.login({ username: 'admin', password: 'admin' })
    await store.logout()
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('isAdmin is true only for admin role', async () => {
    const store = useAuthStore()
    await store.login({ username: 'admin', password: 'admin' })
    expect(store.isAdmin).toBe(true)
  })
})
```

Key rules:
- `setActivePinia(createPinia())` in `beforeEach` — fresh store each test
- `localStorage.clear()` to prevent token pollution between tests
- Mock API functions with `vi.mock('@/api/<domain>')` to control responses

---

## Testing a composable

```ts
// composables/__tests__/useBulkOperations.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { useBulkOperations } from '@/composables/useBulkOperations'

const items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]

describe('useBulkOperations', () => {
  it('tracks selection', () => {
    const bulk = useBulkOperations({ operations: [] })
    bulk.selectItem(items[0])
    expect(bulk.selectedCount.value).toBe(1)
    expect(bulk.isSelected(items[0])).toBe(true)
  })

  it('executes operation on selected items', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const bulk = useBulkOperations({
      operations: [{ id: 'delete', label: 'Delete', icon: '', action }]
    })
    bulk.selectAll(items)
    await bulk.executeOperation('delete')
    expect(action).toHaveBeenCalledWith(items)
    expect(bulk.selectedCount.value).toBe(0) // deselects after success
  })

  it('returns false and does not deselect on operation error', async () => {
    const action = vi.fn().mockRejectedValue(new Error('fail'))
    const bulk = useBulkOperations({
      operations: [{ id: 'op', label: 'Op', icon: '', action }]
    })
    bulk.selectItem(items[0])
    const result = await bulk.executeOperation('op')
    expect(result).toBe(false)
    expect(bulk.selectedCount.value).toBe(1) // still selected
  })
})
```

---

## Testing a Vue component

```ts
// components/__tests__/StatusBadge.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/common/StatusBadge.vue'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    const wrapper = mount(StatusBadge, { props: { value: 'passed', type: 'result' } })
    expect(wrapper.text()).toContain('passed')
  })

  it('applies the correct color class for failed', () => {
    const wrapper = mount(StatusBadge, { props: { value: 'failed', type: 'result' } })
    expect(wrapper.html()).toContain('#ef4444')
  })
})
```

For components that use PrimeVue, mount with the PrimeVue plugin:

```ts
import PrimeVue from 'primevue/config'

const wrapper = mount(MyComponent, {
  global: { plugins: [PrimeVue] }
})
```

---

## Mocking

- Mock API functions with `vi.mock('@/api/<domain>')` — do not mock stores themselves
- Mock `vi.fn()` for callbacks and event handlers
- Mock `localStorage` by calling `localStorage.clear()` in `beforeEach`
- For timer-based logic, use `vi.useFakeTimers()` and `vi.runAllTimers()`
