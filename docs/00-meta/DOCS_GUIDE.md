# DOCS GUIDE — How this documentation is organized

---

## Directory structure

```
docs/
├── 00-meta/          Guides about the docs and repo itself
│   ├── AGENTS.md     — How LLMs/agents should work here
│   ├── CONTRIBUTING.md — Developer onboarding and workflow
│   ├── DOCS_GUIDE.md — This file
│   └── GLOSSARY.md   — Canonical domain term definitions
│
├── 01-product/       Product-level context
│   ├── index.md      — What Testoria is, who uses it, key workflows
│   └── features/     — One file per feature: what it does, who uses it, key behaviours
│
├── 02-architecture/  Technical architecture
│   ├── ARCHITECTURE.md — Authoritative codemap + layer rules (read this first)
│   ├── frontend/     — Deep-dives into specific frontend topics
│   │   ├── structure.md
│   │   ├── state-management.md
│   │   ├── routing.md
│   │   └── api-layer.md
│   └── decisions/    — Architecture Decision Records (ADRs)
│       ├── ADR-001-vue3.md
│       └── ADR-002-pinia.md
│
├── 03-engineering/   Implementation guides and patterns
│   ├── FRONTEND.md   — Frontend development guide (setup, env, common tasks)
│   ├── patterns/     — How specific patterns are implemented
│   │   ├── component-patterns.md
│   │   ├── composables.md
│   │   ├── forms.md
│   │   └── charts.md
│   ├── testing/      — Testing approach and examples
│   │   ├── strategy.md
│   │   ├── unit.md
│   │   └── e2e.md
│   └── performance.md
│
├── 04-execution/     Active project state
│   ├── tech-debt.md  — Known issues and deferred improvements
│   └── exec-plans/   — Feature execution plans
│       ├── templates/   — plan-template.md (copy from here)
│       ├── active/      — Plans currently in progress
│       └── completed/   — Finished plans (moved here when all DoD items checked)
│
├── 05-quality/       Quality standards and checklists
│   ├── QUALITY_SCORE.md
│   ├── RELIABILITY.md
│   ├── SECURITY.md
│   └── checklists/
│       ├── pr-checklist.md
│       └── release-checklist.md
│
├── 06-generated/     Auto-generated or manually synced reference docs
│   ├── routes-map.md — All app routes (sync with src/router/index.ts)
│   ├── api-schema.md — API endpoints used by the frontend
│   └── db-schema.md  — Backend data model reference
│
├── 07-references/    Quick-reference material
│   └── llm/          — Context files for LLM-assisted development
│       ├── frontend-rules.txt   — Hard rules for code generation
│       ├── coding-standards.txt — TypeScript/Vue standards
│       └── design-system.txt    — PrimeVue component patterns
│
└── 08-decisions/     Decision log
    └── changelog.md  — Record of significant architectural decisions
```

---

## What to read first

**New developer**: `CONTRIBUTING.md` → `ARCHITECTURE.md` → `GLOSSARY.md`

**LLM agent**: `AGENTS.md` → `docs/07-references/llm/` (all three files) → `ARCHITECTURE.md`

**Debugging a bug**: `ARCHITECTURE.md` (codemap) → relevant `02-architecture/frontend/` doc

**Adding a feature**: `AGENTS.md` (checklist) → `03-engineering/patterns/` → `07-references/llm/frontend-rules.txt`

---

## Keeping docs up to date

The full update checklist lives in `docs/05-quality/checklists/pr-checklist.md`. Short version:

| Trigger | Doc to update |
|---|---|
| Routes added or changed | `docs/06-generated/routes-map.md` |
| API functions added or changed | `docs/06-generated/api-schema.md` |
| New feature shipped | Create `docs/01-product/features/<name>.md` |
| Existing feature changed | Update `docs/01-product/features/<name>.md` |
| Architectural decision made | `docs/08-decisions/changelog.md` |
| New tech debt | `docs/04-execution/tech-debt.md` (Active section) |
| Tech debt resolved | `docs/04-execution/tech-debt.md` (move to Resolved) |
| New composable or store pattern | Relevant `docs/03-engineering/` doc |
| Quality metric changed | `docs/05-quality/QUALITY_SCORE.md` |
| Plan finished | Move from `exec-plans/active/` → `exec-plans/completed/` |

**Invariant rules:**
- ADRs in `docs/02-architecture/decisions/` are append-only — never edit a closed ADR.
- LLM reference files in `docs/07-references/llm/` must be updated whenever architectural rules change.
- `docs/06-generated/` files are manually synced — they are not auto-generated.

---

## Document format conventions

- All markdown files use ATX headings (`#`, `##`, `###`).
- Code blocks specify language (`ts`, `vue`, `bash`, etc.).
- Tables preferred over bullet lists for structured comparisons.
- Keep files focused — one clear topic per file, cross-link rather than duplicate.
