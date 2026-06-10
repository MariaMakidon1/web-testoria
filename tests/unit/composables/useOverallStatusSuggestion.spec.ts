import { describe, it, expect } from "vitest";
import { suggestOverallStatus } from "@/composables/useOverallStatusSuggestion";
import type { StepResult } from "@/types/testResult";

const step = (index: number, status: StepResult["status"]): StepResult => ({
  index,
  status,
});

describe("suggestOverallStatus", () => {
  it("returns no_run for empty step results", () => {
    expect(suggestOverallStatus([], 5)).toBe("no_run");
  });

  it("returns passed when all steps passed and count matches", () => {
    expect(
      suggestOverallStatus([step(0, "passed"), step(1, "passed")], 2),
    ).toBe("passed");
  });

  it("returns no_run when all steps passed but count does not match (partial)", () => {
    expect(
      suggestOverallStatus([step(0, "passed"), step(1, "passed")], 5),
    ).toBe("no_run");
  });

  it("returns failed when any step is failed", () => {
    expect(
      suggestOverallStatus(
        [step(0, "passed"), step(1, "failed"), step(2, "blocked")],
        3,
      ),
    ).toBe("failed");
  });

  it("returns blocked when any step is blocked and none failed", () => {
    expect(
      suggestOverallStatus([step(0, "passed"), step(1, "blocked")], 3),
    ).toBe("blocked");
  });

  it("returns no_run when all steps are no_run", () => {
    expect(
      suggestOverallStatus([step(0, "no_run"), step(1, "no_run")], 5),
    ).toBe("no_run");
  });

  it("returns no_run for mixed passed and no_run (partial coverage)", () => {
    expect(
      suggestOverallStatus([step(0, "passed"), step(1, "no_run")], 3),
    ).toBe("no_run");
  });
});
