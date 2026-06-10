# GLOSSARY — Testoria Domain Terms

Canonical definitions for all domain concepts used in this codebase.

---

## Core Domain

**Project**
Top-level organizational unit. Contains test suites, test cases, and test runs. Identified by a short `key` (e.g., `PROJ`). Can be archived.

**TestSuite**
A hierarchical folder-like grouping of TestCases within a Project. Suites can nest (parent_suite_id). Each Project has a suite tree used for navigation in the sidebar.

**TestCase**
A reusable specification for a single testable behavior. Has title, description, preconditions, a list of TestSteps, priority (`critical|high|medium|low`), type (`manual|automated`), and status (`draft|active|deprecated`). A TestCase is not an execution — it is the spec.

**TestStep**
One atomic action within a TestCase. Has `step` (what to do) and `expected` (what should happen). TestSteps are stored as a JSON array on the TestCase.

**TestRun**
A planned execution of a set of TestCases, created for a specific environment/build/context. Belongs to a Project and optionally a TestSuite. Has a status (`planned` / `active` / `completed` / `aborted`) and a `progress` summary (pass counts, pass rate). Only `completed` runs contribute to dashboard and report pass-rate aggregates.

**TestResult**
One execution record of a specific TestCase within a specific TestRun. Records the `ResultStatus`, execution time, tester, timestamp, optional defects, and attachments. This is the output of executing a TestCase.

**Defect**
A bug or issue linked to a TestResult. Tracked by external system (`jira`, `github`, `gitlab`, or `custom`) with a key and optional URL.

**Attachment**
A file or image attached to a TestResult. Stored as a filename/path pair on the backend.

**Milestone**
A time-boxed release marker. TestRuns can be associated with a Milestone (milestone_id). Type is defined in `src/types/milestone.ts`.

---

## Status Enums

**ResultStatus** (on TestResult)
`passed` | `failed` | `blocked` | `skipped` — "untested" is the absence of a result, not a status value

**TestRunStatus** (on TestRun)
`planned` | `active` | `completed` | `aborted` — `planned` is a fresh scaffolded run; `active` flips on first result submit (auto backend-side, optimistically frontend-side); `completed` counts toward dashboard/report aggregates; `aborted` is a terminal non-completed state. Legacy `in_progress` wire responses are normalised to `active` at the API-adapter boundary during the api plan-039 rollout window.

**Priority** (on TestCase)
`critical` | `high` | `medium` | `low`

**TestCaseType** (on TestCase)
`manual` | `automated`

**TestCaseStatus** (on TestCase)
`draft` | `active` | `deprecated`

**UserRole** (on User)
`admin` | `lead` | `tester` | `read_only` | `no_access`

---

## Auth / Access

**isAdmin** — computed flag in `stores/auth`. True only for `admin` role.

**isProjectManager** — computed flag in `stores/auth`. True for `admin` AND `lead`.

**canManageTests** — computed flag in `stores/auth`. True for `admin`, `lead`, AND `tester`. `read_only` and `no_access` cannot manage tests.

---

## Technical Terms

**PaginatedResponse\<T\>** — standard list response envelope: `{ items: T[], total, page, page_size, total_pages }`.

**ApiResponse\<T\>** — standard single-item response envelope: `{ data: T, message? }`.

**TestRunProgress** — summary counters on a TestRun: `{ total, passed, failed, blocked, skipped, untested, pass_rate }`.

**TestRunConfig** — key/value metadata on a TestRun for environment info (browser, OS, build number, environment name).

**TestResultHistory** — audit trail of status changes on a TestResult. Each change records who changed it and when.

**SavedFilter** — a named, persisted set of filter values for a list view. Stored in `stores/savedFilters`.

---

## Navigation Hierarchy

```
Projects
  └── Project
        ├── TestSuites (tree)
        │     └── TestSuite
        │           └── TestCases
        │                 └── TestCase (detail, edit)
        └── TestRuns
              └── TestRun (detail)
                    └── TestRunExecution (recording results)
                          └── TestResult (per test case)
```
