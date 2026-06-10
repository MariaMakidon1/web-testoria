# Frontend Structure

Deep-dive into the `src/` directory layout. See `ARCHITECTURE.md` for the authoritative overview.

---

## Directory map with ownership

```
src/
├── api/                  HTTP boundary — one file per domain
│   ├── client.ts         Axios instance, request/response interceptors
│   ├── auth.ts
│   ├── projects.ts
│   ├── testSuites.ts
│   ├── testCases.ts
│   ├── testRuns.ts
│   ├── testResults.ts
│   └── reports.ts
│
├── stores/               Pinia stores — shared state, one per domain
│   ├── auth.ts           JWT, current user, role flags
│   ├── users.ts          Admin user management (list, CRUD, bulk, export)
│   ├── ui.ts             Sidebar, dark mode, notifications, global loading
│   ├── preferences.ts    Theme, persistent display settings
│   ├── projects.ts
│   ├── testSuites.ts
│   ├── testCases.ts
│   ├── testRuns.ts
│   ├── testResults.ts
│   ├── savedFilters.ts   Named, persisted filter sets
│   └── notifications.ts  (alias/wrapper for ui store notifications)
│
├── types/                TypeScript types — no runtime imports
│   ├── api.ts            PaginatedResponse, ApiResponse, ErrorResponse
│   ├── auth.ts           User, UserRole, LoginRequest, TokenResponse
│   ├── project.ts        Project, ProjectCreate, ProjectUpdate, ProjectStats
│   ├── testSuite.ts      TestSuite, TestSuiteTree, Create/Update
│   ├── testCase.ts       TestCase, TestStep, Priority, TestCaseType, TestCaseStatus, Tag
│   ├── testRun.ts        TestRun, TestRunStatus, TestRunProgress, Config
│   ├── testResult.ts     TestResult, ResultStatus, Defect, Attachment
│   ├── report.ts         Report-related types
│   ├── user.ts           UserCreate, UserUpdate, UserBulkCreate, UserBulkResult
│   ├── milestone.ts      Milestone
│   └── index.ts          Re-export barrel (avoid for new imports — use specific file)
│
├── composables/          Reusable logic (not state)
│   ├── useExport.ts       JSON/CSV/XML browser download
│   ├── useExcelExport.ts  ExcelJS multi-sheet export
│   ├── usePdfExport.ts    jsPDF table export
│   ├── useImport.ts       JSON/CSV file parsing + validation
│   ├── useBulkOperations.ts Generic multi-select + bulk action
│   └── useAccessibility.ts Keyboard detection, SR announce, focus trap, useKeyboardShortcuts()
│
├── router/
│   └── index.ts          All routes + navigation guard
│
├── views/                One component per route (thin shells)
│   ├── auth/
│   │   └── LoginView.vue
│   ├── dashboard/
│   │   └── DashboardView.vue
│   ├── projects/
│   │   ├── ProjectListView.vue
│   │   └── ProjectDetailView.vue
│   ├── test-cases/
│   │   ├── TestCasesIndexView.vue
│   │   ├── TestCaseListView.vue
│   │   ├── TestCaseDetailView.vue
│   │   └── TestCaseEditorView.vue
│   ├── test-runs/
│   │   ├── TestRunListView.vue
│   │   ├── TestRunDetailView.vue
│   │   ├── TestRunCreateView.vue
│   │   └── TestRunExecutionView.vue
│   ├── reports/
│   │   └── ReportDashboardView.vue
│   ├── users/
│   │   ├── UserListView.vue
│   │   └── UserDetailView.vue
│   └── settings/
│       └── SettingsView.vue
│
├── components/
│   ├── common/           Generic, domain-agnostic components
│   │   ├── index.ts      Barrel export for global registration
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   ├── DataTableWrapper.vue
│   │   ├── BulkActionsBar.vue
│   │   ├── FilterPanel.vue
│   │   ├── EmptyState.vue
│   │   ├── LoadingState.vue
│   │   ├── StatusBadge.vue
│   │   ├── ConfirmDialog.vue
│   │   ├── NotificationToast.vue
│   │   ├── SavedFiltersDropdown.vue
│   │   ├── RichTextEditor.vue
│   │   ├── ImportExportDialog.vue
│   │   ├── ImageUploadArea.vue
│   │   ├── KeyboardShortcutsDialog.vue
│   │   └── SkipLink.vue
│   ├── test-cases/       Feature-specific components
│   │   ├── TestSuiteTree.vue
│   │   ├── TestCaseTreeView.vue
│   │   ├── TestStepsEditor.vue
│   │   └── TestCaseSection.vue
│   ├── test-runs/
│   │   ├── DefectsPanel.vue
│   │   ├── SuiteTreeResults.vue    Shared suite-grouped case list (read / execute modes)
│   │   ├── SuiteTreeBranch.vue     Recursive branch used by SuiteTreeResults
│   │   ├── TestResultsList.vue
│   │   ├── TestResultDetail.vue
│   │   └── TestResultHistoryPanel.vue
│   └── users/
│       └── UserForm.vue
│
├── layouts/
│   └── DefaultLayout.vue  Sidebar + header wrapper for all auth views
│
├── assets/
│   └── styles/
│       ├── main.css       Global styles, PrimeVue theme customizations
│       └── variables.css  CSS custom properties (colors, spacing, radius)
│
├── utils/
│   └── localStorage.ts    Typed helpers for localStorage access
│
├── App.vue                Root component, router-view
├── main.ts                App bootstrap (Vue app, Pinia, Router, PrimeVue)
└── vite-env.d.ts          Vite env type declarations
```

---

## What lives where

**Business logic**: stores. Views are thin — they call store actions, read store state, render components.

**HTTP calls**: `api/<domain>.ts` only. All calls go through `apiClient` (Axios instance).

**Shared types**: `types/<domain>.ts`. Zero imports from other src layers.

**Reusable behavior**: composables. Not components — composables extract logic without rendering anything.

**UI patterns**: `components/common/`. Check here before building something new.
