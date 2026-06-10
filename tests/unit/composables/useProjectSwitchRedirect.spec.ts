import { describe, it, expect } from "vitest";
import { redirectTargetForSwitch } from "@/composables/useProjectSwitchRedirect";

const route = (name: string | null, params: Record<string, string> = {}) =>
  ({ name, params }) as never;

describe("redirectTargetForSwitch", () => {
  it("redirects TestRunDetail to TestRuns list", () => {
    expect(redirectTargetForSwitch(route("TestRunDetail"), 7)).toEqual({
      name: "TestRuns",
    });
  });

  it("redirects TestRunExecution to TestRuns list", () => {
    expect(redirectTargetForSwitch(route("TestRunExecution"), 7)).toEqual({
      name: "TestRuns",
    });
  });

  it("redirects TestRunCreate to TestRuns list", () => {
    expect(redirectTargetForSwitch(route("TestRunCreate"), 7)).toEqual({
      name: "TestRuns",
    });
  });

  it("redirects TestCaseDetail to project test-cases list", () => {
    expect(redirectTargetForSwitch(route("TestCaseDetail"), 7)).toEqual({
      name: "TestCases",
      params: { projectId: "7" },
    });
  });

  it("redirects TestCaseEdit to project test-cases list", () => {
    expect(redirectTargetForSwitch(route("TestCaseEdit"), 7)).toEqual({
      name: "TestCases",
      params: { projectId: "7" },
    });
  });

  it("swaps projectId for TestCases route", () => {
    expect(
      redirectTargetForSwitch(route("TestCases", { projectId: "3" }), 7),
    ).toEqual({ name: "TestCases", params: { projectId: "7" } });
  });

  it("no-ops when TestCases projectId is already the new id", () => {
    expect(
      redirectTargetForSwitch(route("TestCases", { projectId: "7" }), 7),
    ).toBeNull();
  });

  it("no-ops for non-project-scoped routes", () => {
    expect(redirectTargetForSwitch(route("Dashboard"), 7)).toBeNull();
    expect(redirectTargetForSwitch(route("Reports"), 7)).toBeNull();
    expect(redirectTargetForSwitch(route("Settings"), 7)).toBeNull();
    expect(redirectTargetForSwitch(route("TestCasesIndex"), 7)).toBeNull();
    expect(redirectTargetForSwitch(route("TestRuns"), 7)).toBeNull();
  });

  it("no-ops when route has no name", () => {
    expect(redirectTargetForSwitch(route(null), 7)).toBeNull();
  });

  it("no-ops on case-scoped route when newProjectId is null", () => {
    expect(redirectTargetForSwitch(route("TestCaseDetail"), null)).toBeNull();
  });
});
