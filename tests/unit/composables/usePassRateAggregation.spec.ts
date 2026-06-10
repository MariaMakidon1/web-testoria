import { describe, it, expect } from "vitest";
import { aggregatePassRatesByProject } from "@/composables/usePassRateAggregation";
import type { TestRun } from "@/types/testRun";
import type { Project } from "@/types/project";

const makeProject = (id: number, name: string, archived = false): Project => ({
  id,
  name,
  description: null,
  is_archived: archived,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
});

const makeRun = (
  id: number,
  projectId: number,
  passRate: number,
  status: "completed" | "planned" = "completed",
): TestRun =>
  ({
    id,
    project_id: projectId,
    suite_id: null,
    milestone_id: null,
    name: `Run ${id}`,
    config: null,
    assigned_to: null,
    status,
    created_at: "2024-01-01T00:00:00Z",
    completed_at: status === "completed" ? "2024-01-02T00:00:00Z" : null,
    progress: {
      total: 10,
      passed: Math.round(passRate / 10),
      failed: 0,
      blocked: 0,
      no_run: 10 - Math.round(passRate / 10),
      pass_rate: passRate,
    },
  }) as TestRun;

describe("aggregatePassRatesByProject", () => {
  it("returns null overall when there are no runs", () => {
    const result = aggregatePassRatesByProject(
      [],
      [makeProject(1, "Alpha")],
    );
    expect(result.overall).toBeNull();
    expect(result.perProject[0].passRate).toBeNull();
  });

  it("computes single project average correctly", () => {
    const runs = [makeRun(1, 1, 80), makeRun(2, 1, 90), makeRun(3, 1, 100)];
    const result = aggregatePassRatesByProject(runs, [makeProject(1, "Alpha")]);
    expect(result.overall).toBe(90);
    expect(result.perProject[0].passRate).toBe(90);
    expect(result.perProject[0].runCount).toBe(3);
  });

  it("computes average of per-project averages (not run-weighted)", () => {
    const runs = [
      makeRun(1, 1, 95),
      makeRun(2, 1, 95),
      makeRun(3, 1, 95),
      makeRun(4, 1, 95),
      makeRun(5, 1, 95),
      makeRun(6, 2, 40),
    ];
    const projects = [makeProject(1, "Big"), makeProject(2, "Small")];
    const result = aggregatePassRatesByProject(runs, projects);
    expect(result.overall).toBe(67.5);
  });

  it("excludes projects with zero completed runs from overall", () => {
    const runs = [makeRun(1, 1, 80)];
    const projects = [makeProject(1, "Active"), makeProject(2, "Empty")];
    const result = aggregatePassRatesByProject(runs, projects);
    expect(result.overall).toBe(80);
    expect(result.perProject.find((p) => p.projectId === 2)?.passRate).toBeNull();
  });

  it("excludes archived projects by default", () => {
    const runs = [makeRun(1, 1, 80), makeRun(2, 2, 50)];
    const projects = [
      makeProject(1, "Active"),
      makeProject(2, "Old", true),
    ];
    const result = aggregatePassRatesByProject(runs, projects);
    expect(result.perProject).toHaveLength(1);
    expect(result.overall).toBe(80);
  });

  it("filters to selected project when selectedProjectId is set", () => {
    const runs = [makeRun(1, 1, 80), makeRun(2, 2, 50)];
    const projects = [makeProject(1, "A"), makeProject(2, "B")];
    const result = aggregatePassRatesByProject(runs, projects, {
      selectedProjectId: 2,
    });
    expect(result.perProject).toHaveLength(1);
    expect(result.overall).toBe(50);
  });

  it("ignores non-completed runs", () => {
    const runs = [makeRun(1, 1, 80), makeRun(2, 1, 50, "planned")];
    const result = aggregatePassRatesByProject(runs, [makeProject(1, "A")]);
    expect(result.overall).toBe(80);
    expect(result.perProject[0].runCount).toBe(1);
  });

  it("sorts perProject by name", () => {
    const runs = [makeRun(1, 1, 80), makeRun(2, 2, 50)];
    const projects = [makeProject(2, "Zebra"), makeProject(1, "Alpha")];
    const result = aggregatePassRatesByProject(runs, projects);
    expect(result.perProject[0].name).toBe("Alpha");
    expect(result.perProject[1].name).toBe("Zebra");
  });
});
