# Execution Plan: Test Run Wizard Step Numbers Start at 1, Not 0 (TES-75)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

The Stepper at the top of the **Create Test Run** wizard renders its three step badges as **1**, **2**, **3** (matching the natural-language references in the form headings and in this app's docs), not **0**, **1**, **2**.

Linear: [TES-75](https://linear.app/testoria/issue/TES-75/test-run-wizard-step-indicator-starts-at-0-instead-of-1) — Bug, Medium.

---

## Context

`src/views/test-runs/TestRunCreateView.vue` uses PrimeVue's `<Stepper>`/`<Step>`/`<StepPanel>`. The `:value` prop on each `<Step>` is **both** the identifier the parent `<Stepper>` uses for `v-model:value` synchronisation **and** the number rendered in the step badge. The view sets:

```vue
<Step :value="0">Basic Information</Step>
<Step :value="1">Select Test Cases</Step>
<Step :value="2">Review & Create</Step>
```

…paired with `const activeStep = ref<number>(0);` and `activeStep.value === 0` as the validation guard. The badges render **0 / 1 / 2** — a developer convention bleeding into the UI.

The fix is a coordinated rename: shift every `:value` and the `activeStep` ref's initial value by `+1`. The increment/decrement logic in `nextStep` / `prevStep` is range-shift-invariant (`++` / `--` still walks 1 → 2 → 3 the same way it walked 0 → 1 → 2), so only the numeric anchors change.

No backend, no API, no schema. No persisted state references the step number. No tests assert the old values.

---

## Scope

### In scope

- `src/views/test-runs/TestRunCreateView.vue`: update **all six** numeric step anchors (`<Step :value=...>` × 3, `<StepPanel :value=...>` × 3), the `activeStep` ref's initial value, and the `validateStep1` guard's comparison. Six lines (`0→1`, `1→2`, `2→3`, ref init `0→1`, guard `===0` → `===1`).
- E2E coverage: extend `tests/e2e/test-runs.spec.ts` so the existing "Next button advances" or "created run appears" cases assert the visible step badges read **1** and **2** at the relevant points. Use a text-content assertion on the `.p-stepper` step header, not a screenshot diff.

### Out of scope

- Migrating to a named-step model (e.g., `'basics' | 'cases' | 'review'`). Cleaner long-term but a wider refactor; not what this bug needs and not without QA review of the UX.
- Other PrimeVue Stepper instances elsewhere in the app — none exist today (`grep -rn '<Stepper' src/` returns only `TestRunCreateView.vue`). If a second Stepper is added later, the same 1-indexed convention should be followed.
- Persisting wizard progress to URL or localStorage (e.g., `?step=2`). Worth doing for back-button restoration; separate plan.
- Rewording the in-step headings ("Step 1: Basic Info", etc.) — these already say "1/2/3" in the comments / commentary; they were always correct.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/test-runs/TestRunCreateView.vue` | Six numeric anchors + the `activeStep` initial value + the `=== 0` guard, all shifted by +1 |
| tests | `tests/e2e/test-runs.spec.ts` | Add an assertion that the first visible step badge reads "1" on the create-wizard page |

### Key decisions

- **Renumber, don't rename to strings.** Step `:value` accepts any value type; switching to `'basics'/'cases'/'review'` would be more readable but reshapes the integer arithmetic in `nextStep`/`prevStep`. Smallest blast radius beats nicest abstraction for a Medium-priority cosmetic bug.
- **Keep `activeStep` numeric.** It is not consumed by anything outside the file (no store, no router, no persistence). Renumbering preserves the existing increment/decrement logic 1:1.
- **E2E assertion on the rendered step badge text.** PrimeVue Stepper renders the value inside a `.p-step-number` span; a `toContainText('1')` on the first badge is stable across PrimeVue minor bumps and clearly verifies the user-visible behaviour.
- **No screenshot test.** Visual diff would catch this class of bug in general but is overkill for a one-off cosmetic fix; the text assertion is sufficient and stays green across unrelated UI tweaks.

---

## Tasks

### Implementation
- [x] In `src/views/test-runs/TestRunCreateView.vue`:
  - [x] `const activeStep = ref<number>(0)` → `ref<number>(1)`
  - [x] `<Step :value="0">` → `<Step :value="1">` (and 1→2, 2→3) for all three `<Step>` and all three `<StepPanel>` elements
  - [x] `if (activeStep.value === 0 && !validateStep1()) return;` → `=== 1`
  - [x] Spot-check the dev server: open `/test-runs/create`, confirm badges read 1/2/3 and Next advances correctly through validation

### Tests
- [x] In `tests/e2e/test-runs.spec.ts`: add an assertion that on `/test-runs/create`, the first step header badge contains `1` (not `0`)

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/005-test-run-planning.md` — note that the wizard's Stepper uses 1-indexed `:value` anchors (mirrors the visible badges) so the convention is unambiguous for future Stepper additions
- [x] `docs/08-decisions/changelog.md` — plan-088 entry: 1-indexed step badges in the Create Test Run wizard
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A different file depends on the literal `0/1/2` step values (router param, persisted state, telemetry event) | Very low | `grep -rn 'activeStep\|step.*0\|step.*1\|step.*2' src/` shows no consumer outside this file. Confirmed during plan write |
| Future PrimeVue update changes how `:value` is rendered | Low | Project pins PrimeVue 4. The Stepper API surface around `value` is stable in that line |
| The `validateStep1` guard typo when changing `=== 0` → `=== 1` | Very low | Tests would catch it; manual smoke covers the validation path on Step 1 |

---

## Definition of done

- [x] Step badges in `/test-runs/create` read **1**, **2**, **3** (not **0**, **1**, **2**)
- [x] Next/Back navigation still works end-to-end through all three steps
- [x] Step 1 validation still blocks Next when project or name are missing
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] E2E assertion confirms the first badge reads "1"
- [x] Feature doc + changelog updated
- [x] TES-75 marked Done in Linear with the merge commit linked
