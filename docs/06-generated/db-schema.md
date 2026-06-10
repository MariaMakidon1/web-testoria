# DB SCHEMA — Backend Data Model Reference
# This is the frontend's view of the backend data model, derived from src/types/*.ts.
# For the authoritative schema, see the backend repository.

---

## Entities and their TypeScript types

### User (`src/types/auth.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | number | PK |
| username | string | unique login name |
| email | string | |
| full_name | string \| null | |
| role | UserRole | `admin` \| `lead` \| `tester` \| `read_only` \| `no_access` |
| is_active | boolean | |
| created_at | string | ISO datetime |
| updated_at | string \| null | |

### Project (`src/types/project.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | number | PK |
| name | string | |
| description | string \| null | |
| is_archived | boolean | |
| created_at | string | |
| updated_at | string \| null | |

### TestSuite (`src/types/testSuite.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | number | PK |
| project_id | number | FK → Project.id |
| parent_suite_id | number \| null | FK → TestSuite.id (null = root) |
| name | string | |
| description | string \| null | |
| display_order | number \| null | sort key, gap-based; `(display_order NULLS LAST, name)` sort (plan-093) |
| created_at | string | |
| updated_at | string \| null | |
| test_case_count? | number | client-computed, not returned by backend |

### TestCase (`src/types/testCase.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | number | PK |
| suite_id | number | FK → TestSuite.id |
| title | string | |
| description | string \| null | HTML (Tiptap) |
| preconditions | string \| null | HTML (Tiptap) |
| steps | TestStep[] | JSON array `[{ step, expected }]` |
| priority | Priority | `critical` \| `high` \| `medium` \| `low` |
| type | TestCaseType | `manual` \| `automated` |
| status | TestCaseStatus | `draft` \| `active` \| `deprecated` |
| automation_id? | string \| null | external test identifier (Playwright spec, pytest node id) |
| display_order? | number \| null | sort key inside the parent suite, gap-based; `(display_order NULLS LAST, id)` sort (plan-093 + api plan-046) |
| created_at | string | |
| updated_at | string \| null | |
| tags? | Tag[] | `[{ id, name }]` |

### Tag (`src/types/testCase.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | number | PK |
| name | string | Global scope (not project-scoped) |

### TestRun (`src/types/testRun.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | number | PK |
| project_id | number | FK → Project.id |
| suite_id | number \| null | FK → TestSuite.id (optional scope) |
| milestone_id | number \| null | FK → Milestone.id |
| name | string | |
| description | string \| null | |
| config | TestRunConfig \| null | JSON `{ environment?, browser?, os?, build_number? }` |
| assigned_to | number \| null | FK → User.id |
| status | TestRunStatus | `Active` \| `Completed` \| `Aborted` |
| created_by | number | FK → User.id |
| created_at | string | |
| completed_at | string \| null | |
| progress? | TestRunProgress | computed `{ total, passed, failed, blocked, skipped, untested, pass_rate }` |

### TestResult (`src/types/testResult.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | number | PK |
| test_run_id | number | FK → TestRun.id |
| test_case_id | number | FK → TestCase.id |
| status | ResultStatus | `passed` \| `failed` \| `blocked` \| `skipped` |
| comment | string \| null | HTML |
| message | string \| null | error message or notes |
| stack_trace | string \| null | for automated test failures |
| execution_time | number \| null | seconds |
| defects | Defect[] \| null | `[{ tracker, key, url?, summary? }]` |
| tested_by | number \| null | FK → User.id |
| tested_at | string | ISO datetime |
| attachments? | Attachment[] | |
| test_case? | TestResultTestCase | embedded snapshot of test case metadata |

### Milestone (`src/types/milestone.ts`)

See `src/types/milestone.ts` for full shape. Referenced by TestRun.milestone_id.

---

## Relationships summary

```
Project
  ├── TestSuite (1:N, hierarchical)
  │     └── TestCase (1:N)
  │           └── Tag (M:N via test_case_tags)
  └── TestRun (1:N)
        └── TestResult (1:N, one per TestCase in the run)
              ├── Defect[] (embedded)
              └── Attachment[] (1:N)

User
  ├── created_by on TestRun
  ├── assigned_to on TestRun
  └── tested_by on TestResult
```
