import { describe, it, expect } from "vitest";
import {
  computeSuiteState,
  toggleSuite,
  toggleCase,
} from "@/composables/useSuiteSelection";
import type { TestSuiteTree } from "@/types/testSuite";
import type { TestCase } from "@/types/testCase";

const makeCase = (id: number, suiteId: number): TestCase => ({
  id,
  suite_id: suiteId,
  title: `Case ${id}`,
  description: null,
  preconditions: null,
  steps: [],
  priority: "medium",
  type: "manual",
  status: "active",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
});

const makeSuite = (
  id: number,
  children: TestSuiteTree[] = [],
  level = 0,
): TestSuiteTree => ({
  id,
  project_id: 1,
  parent_suite_id: null,
  name: `Suite ${id}`,
  description: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  children,
  level,
  expanded: true,
});

describe("useSuiteSelection", () => {
  describe("computeSuiteState", () => {
    it("returns unchecked for empty suite", () => {
      const suite = makeSuite(1);
      const state = computeSuiteState(suite, new Set(), { 1: [] });
      expect(state).toBe("unchecked");
    });

    it("returns unchecked when no cases loaded", () => {
      const suite = makeSuite(1);
      const state = computeSuiteState(suite, new Set(), {});
      expect(state).toBe("unchecked");
    });

    it("returns checked when all cases selected", () => {
      const suite = makeSuite(1);
      const cases = { 1: [makeCase(10, 1), makeCase(11, 1)] };
      const selected = new Set([10, 11]);
      expect(computeSuiteState(suite, selected, cases)).toBe("checked");
    });

    it("returns indeterminate when some cases selected", () => {
      const suite = makeSuite(1);
      const cases = { 1: [makeCase(10, 1), makeCase(11, 1)] };
      const selected = new Set([10]);
      expect(computeSuiteState(suite, selected, cases)).toBe("indeterminate");
    });

    it("includes descendant suites in calculation", () => {
      const child = makeSuite(2, [], 1);
      const parent = makeSuite(1, [child]);
      const cases = {
        1: [makeCase(10, 1)],
        2: [makeCase(20, 2)],
      };

      expect(computeSuiteState(parent, new Set([10, 20]), cases)).toBe(
        "checked",
      );
      expect(computeSuiteState(parent, new Set([10]), cases)).toBe(
        "indeterminate",
      );
      expect(computeSuiteState(parent, new Set(), cases)).toBe("unchecked");
    });
  });

  describe("toggleSuite", () => {
    it("selects all cases when suite is unchecked", () => {
      const suite = makeSuite(1);
      const cases = { 1: [makeCase(10, 1), makeCase(11, 1)] };
      const result = toggleSuite(suite, new Set(), cases, new Set());
      expect(result.caseIds).toEqual(new Set([10, 11]));
      expect(result.suiteIds).toEqual(new Set([1]));
    });

    it("deselects all cases when suite is fully checked", () => {
      const suite = makeSuite(1);
      const cases = { 1: [makeCase(10, 1), makeCase(11, 1)] };
      const result = toggleSuite(suite, new Set([10, 11]), cases, new Set([1]));
      expect(result.caseIds).toEqual(new Set());
      expect(result.suiteIds).toEqual(new Set());
    });

    it("selects remaining cases when suite is indeterminate", () => {
      const suite = makeSuite(1);
      const cases = { 1: [makeCase(10, 1), makeCase(11, 1)] };
      const result = toggleSuite(suite, new Set([10]), cases, new Set());
      expect(result.caseIds).toEqual(new Set([10, 11]));
      expect(result.suiteIds).toEqual(new Set([1]));
    });

    it("propagates to descendant suites", () => {
      const child = makeSuite(2, [], 1);
      const parent = makeSuite(1, [child]);
      const cases = {
        1: [makeCase(10, 1)],
        2: [makeCase(20, 2)],
      };
      const result = toggleSuite(parent, new Set(), cases, new Set());
      expect(result.caseIds).toEqual(new Set([10, 20]));
      expect(result.suiteIds).toEqual(new Set([1, 2]));
    });

    it("respects visibleCaseIds filter", () => {
      const suite = makeSuite(1);
      const cases = { 1: [makeCase(10, 1), makeCase(11, 1), makeCase(12, 1)] };
      const visible = new Set([10, 11]);
      const result = toggleSuite(suite, new Set(), cases, new Set(), visible);
      expect(result.caseIds).toEqual(new Set([10, 11]));
    });

    it("preserves non-visible selections when toggling with filter", () => {
      const suite = makeSuite(1);
      const cases = { 1: [makeCase(10, 1), makeCase(11, 1)] };
      const visible = new Set([10]);
      const result = toggleSuite(
        suite,
        new Set([11]),
        cases,
        new Set(),
        visible,
      );
      expect(result.caseIds).toEqual(new Set([10, 11]));
    });
  });

  describe("toggleCase", () => {
    it("adds case when not selected", () => {
      const result = toggleCase(10, new Set([5]));
      expect(result).toEqual(new Set([5, 10]));
    });

    it("removes case when selected", () => {
      const result = toggleCase(10, new Set([5, 10]));
      expect(result).toEqual(new Set([5]));
    });
  });
});
