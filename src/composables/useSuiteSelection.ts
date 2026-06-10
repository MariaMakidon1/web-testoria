import type { TestCase } from "@/types/testCase";
import type { TestSuiteTree } from "@/types/testSuite";

export type SuiteCheckState = "checked" | "unchecked" | "indeterminate";

function getAllDescendantSuiteIds(suite: TestSuiteTree): number[] {
  const ids: number[] = [];
  for (const child of suite.children) {
    ids.push(child.id);
    ids.push(...getAllDescendantSuiteIds(child));
  }
  return ids;
}

function getSuiteIdsIncludingSelf(suite: TestSuiteTree): number[] {
  return [suite.id, ...getAllDescendantSuiteIds(suite)];
}

export function computeSuiteState(
  suite: TestSuiteTree,
  selectedCaseIds: Set<number>,
  casesBySuite: Record<number, TestCase[]>,
  selectedSuiteIds?: Set<number>,
): SuiteCheckState {
  const suiteIds = getSuiteIdsIncludingSelf(suite);
  let total = 0;
  let selected = 0;

  for (const sid of suiteIds) {
    const cases = casesBySuite[sid] || [];
    total += cases.length;
    for (const tc of cases) {
      if (selectedCaseIds.has(tc.id)) selected++;
    }
  }

  // Subtree has no cases — fall back to explicit suite selection so that
  // empty descendants reflect a parent's "checked" state after cascading.
  if (total === 0) {
    return selectedSuiteIds?.has(suite.id) ? "checked" : "unchecked";
  }
  if (selected === total) return "checked";
  if (selected > 0) return "indeterminate";
  return "unchecked";
}

export interface ToggleSuiteResult {
  caseIds: Set<number>;
  suiteIds: Set<number>;
}

export function toggleSuite(
  suite: TestSuiteTree,
  selectedCaseIds: Set<number>,
  casesBySuite: Record<number, TestCase[]>,
  selectedSuiteIds: Set<number>,
  visibleCaseIds?: Set<number>,
): ToggleSuiteResult {
  const state = computeSuiteState(
    suite,
    selectedCaseIds,
    casesBySuite,
    selectedSuiteIds,
  );
  const shouldCheck = state !== "checked";
  const newCaseIds = new Set(selectedCaseIds);
  const newSuiteIds = new Set(selectedSuiteIds);
  const subtreeSuiteIds = getSuiteIdsIncludingSelf(suite);

  for (const sid of subtreeSuiteIds) {
    if (shouldCheck) {
      newSuiteIds.add(sid);
    } else {
      newSuiteIds.delete(sid);
    }
    const cases = casesBySuite[sid] || [];
    for (const tc of cases) {
      if (visibleCaseIds && !visibleCaseIds.has(tc.id)) continue;
      if (shouldCheck) {
        newCaseIds.add(tc.id);
      } else {
        newCaseIds.delete(tc.id);
      }
    }
  }

  return { caseIds: newCaseIds, suiteIds: newSuiteIds };
}

export function toggleCase(
  caseId: number,
  selectedCaseIds: Set<number>,
): Set<number> {
  const newSet = new Set(selectedCaseIds);
  if (newSet.has(caseId)) {
    newSet.delete(caseId);
  } else {
    newSet.add(caseId);
  }
  return newSet;
}
