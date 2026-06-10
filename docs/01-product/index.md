# Testoria — Product Overview

---

## What is Testoria?

Testoria is a **test management web application**. Teams use it to:

- Organize test cases into hierarchical test suites
- Plan and execute test runs against specific builds or environments
- Record pass/fail/blocked results for each test case
- Track defects linked to failed results
- Generate reports and export data for stakeholders

This repository is the **Vue 3 SPA frontend** only. The backend is a separate service (FastAPI/Python) accessible at `VITE_API_URL`.

---

## Who uses it?

| Role | What they do |
|------|-------------|
| **Admin** | Full access: manage users, projects, all data |
| **Lead** | Create/manage projects, test runs, assign testers |
| **Tester** | Execute test runs, record results, link defects |
| **Read Only** | Read-only access to results and reports |

---

## Core workflow

```
1. Create a Project (key + name)
2. Build a TestSuite tree (folders for grouping)
3. Write TestCases (steps, expected results, priority, type)
4. Create a TestRun (pick suite, environment config, assign tester)
5. Execute the TestRun (open each test case, record result)
6. Review Reports (pass rates, coverage, defect trends)
7. Export data (Excel/PDF/CSV for stakeholders)
```

---

## Key concepts

The single most important mental model:

> **TestCase** = a reusable specification
> **TestResult** = one execution of a TestCase inside a specific **TestRun**

A TestCase can appear in many TestRuns. Each execution creates a new TestResult. History is tracked per TestResult.

---

## Feature inventory

| Feature | Description |
|---------|-------------|
| Project management | Create, archive, view stats per project |
| Suite tree | Hierarchical test suite navigator in the sidebar |
| Test case authoring | Rich text editor, test steps, tags, priority, type |
| Test case import/export | CSV/Excel import; CSV/Excel/JSON export |
| Test run planning | Select suite/cases, set environment config, assign tester |
| Test execution | Step-by-step result recording with defect linking |
| Defect tracking | Link Jira/GitHub/GitLab/custom defects to results |
| Attachments | Upload screenshots/files to test results |
| Result history | Audit trail of result status changes |
| Reports dashboard | Pass rate charts, trend analysis, coverage reports |
| Saved filters | Persist and reuse filter sets on list views |
| Dark mode | Toggle between light and dark themes |
| Accessibility | Keyboard navigation, screen reader announcements, focus trapping |

---

## Tech stack summary

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| State | Pinia 3 |
| Routing | Vue Router 5 |
| UI components | PrimeVue 4 + PrimeIcons |
| HTTP | Axios 1.x |
| Rich text | Tiptap 3 |
| Charts | Chart.js 4 + vue-chartjs |
| Excel export | ExcelJS 4 + file-saver |
| PDF export | jsPDF 4 + jspdf-autotable |
| Date utils | date-fns 4 |
| Build | Vite 6 |
| Types | TypeScript 5.9 |
| Testing | Vitest 4 (unit) + Playwright (e2e) |
| Deploy | Static `dist/` build → host nginx on EC2 via GitHub Actions (api/infra stay in Docker) |
