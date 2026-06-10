# State Management

Pinia stores in Testoria — how they are structured, what goes where, and how to use them.

---

## Store inventory

| Store | File | Purpose |
|-------|------|---------|
| auth | `stores/auth.ts` | JWT tokens, current user, role-derived permission flags |
| ui | `stores/ui.ts` | Sidebar visibility, dark mode, notifications, global loading |
| preferences | `stores/preferences.ts` | Persistent display settings (theme, etc.) |
| projects | `stores/projects.ts` | Project list, current project |
| testSuites | `stores/testSuites.ts` | Suite tree per project. `suiteTree` sorts siblings by `(display_order NULLS LAST, name)` to match backend `apply_suite_order` (plan-093). `reorderTestSuite(id, newDisplayOrder)` is the optimistic drag-reorder action: replaces the row in `testSuites` with the new `display_order`, awaits `PUT /test-suites/:id`, replaces with server response on success, rolls back the captured snapshot on failure. |
| testCases | `stores/testCases.ts` | Test case list, current test case, pagination, filters; `casesBySuite` cache (`Map<suiteId, TestCase[]>`) for lazy suite tree loading in test run create. `fetchTestCasesBySuite` is cache-first; `refreshCasesBySuite` force-refetches and replaces the cached entry (used by `EditRunCasesDialog` on open so stale cases don't leak in). `reorderTestCase(id, suiteId, newDisplayOrder)` is the optimistic drag-reorder action (plan-093): stamps the new `display_order` across every cached list — `casesBySuite[suiteId]`, `testCases`, `allCases[projectId]` — awaits `PUT /test-cases/:id`, replaces with the server response or rolls every list back atomically on failure. |
| testRuns | `stores/testRuns.ts` | Test run list, current run, progress |
| testResults | `stores/testResults.ts` | Results for the current test run; `stepResultsDraft` for per-step status picker |
| milestones | `stores/milestones.ts` | Milestone list per project, CRUD |
| users | `stores/users.ts` | Admin user management — list, CRUD, bulk create, export |
| savedFilters | `stores/savedFilters.ts` | Named, persisted filter sets for list views |
| tags | `stores/tags.ts` | Global tag list, search results (transient), create |
| notifications | `stores/notifications.ts` | Toast notification queue |

---

## Auth store — the most important store

`src/stores/auth.ts`

```ts
// State
user: Ref<User | null>
accessToken: Ref<string | null>     // also in localStorage('access_token')
refreshToken: Ref<string | null>    // also in localStorage('refresh_token')
loading: Ref<boolean>
error: Ref<string | null>           // last recovery-action error (plan-097); recovery views bind to it

// Computed (use these in components — never user.role directly)
isAuthenticated: ComputedRef<boolean>
isAdmin: ComputedRef<boolean>             // role === 'admin'
isProjectManager: ComputedRef<boolean>    // role === 'admin' | 'lead'
canManageTests: ComputedRef<boolean>      // role === 'admin' | 'lead' | 'tester'

// Actions
login(credentials)       // POST /auth/login → set tokens → fetch user
logout()                 // POST /auth/logout → clear tokens (ignores errors)
fetchCurrentUser()       // GET /auth/me → set user
refreshAccessToken()     // POST /auth/refresh → update tokens

// Password recovery (pre-auth; plan-097 / api 048). Set loading/error.
forgotPassword(email)              // POST /auth/forgot-password (no-enumeration; resolves on 202)
resetPassword(token, newPassword)  // POST /auth/reset-password → sets password; rejects on bad token
validateResetToken(token)          // GET /auth/reset-password/validate → result | null (null = invalid)
```

---

## UI store — UI-only state

`src/stores/ui.ts`

```ts
// State
sidebarVisible: Ref<boolean>
sidebarCollapsed: Ref<boolean>
darkMode: Ref<boolean>
notifications: Ref<Notification[]>
globalLoading: Ref<boolean>

// Actions
toggleSidebar()
toggleSidebarCollapsed()
setSidebarVisible(visible: boolean)
toggleDarkMode()          // also persists to localStorage('darkMode')
initDarkMode()            // called on app mount to restore saved preference
addNotification(n)        // returns id; auto-removes after n.life ms if set
removeNotification(id)
setGlobalLoading(loading)
```

**Rule**: any state that is purely about the UI (visible/hidden, loading indicators, toasts) goes in the UI store. Feature stores must not know about modals or sidebar state.

---

## Standard store pattern

Every feature store follows this structure:

```ts
export const useXxxStore = defineStore('xxx', () => {
  // 1. State
  const items = ref<Xxx[]>([])
  const currentItem = ref<Xxx | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

  // 2. Computed
  const hasItems = computed(() => items.value.length > 0)

  // 3. Actions
  async function fetchItems(projectId: number) {
    loading.value = true
    error.value = null
    try {
      const response = await api.getItems(projectId)
      items.value = response.items
      pagination.total = response.total
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  // 4. Return
  return { items, currentItem, loading, error, pagination, hasItems, fetchItems }
})
```

---

## Using stores in components

```ts
// In <script setup lang="ts">
import { useTestCasesStore } from '@/stores/testCases'
import { storeToRefs } from 'pinia'

const store = useTestCasesStore()
// storeToRefs preserves reactivity when destructuring state/computed
const { items, loading, error } = storeToRefs(store)
// Actions are not refs — destructure them directly
const { fetchItems, createItem } = store
```

---

## Cross-store reads

If store A needs data from store B, call `useStoreB()` inside store A's action (not at setup time to avoid circular dep issues):

```ts
// In stores/testCases.ts
async function createTestCase(data: TestCaseCreate) {
  const projectsStore = useProjectsStore() // call inside action
  const projectId = projectsStore.currentProject?.id
  // ...
}
```

Do not import store B's internal refs directly at module level.
