import type { TestRun } from "@/types/testRun";
import type { Project } from "@/types/project";

export interface PerProjectPassRate {
  projectId: number;
  name: string;
  passRate: number | null;
  runCount: number;
}

export interface PassRateAggregation {
  overall: number | null;
  perProject: PerProjectPassRate[];
}

export function aggregatePassRatesByProject(
  runs: TestRun[],
  projects: Project[],
  options?: { excludeArchived?: boolean; selectedProjectId?: number | null },
): PassRateAggregation {
  const excludeArchived = options?.excludeArchived ?? true;
  const selectedProjectId = options?.selectedProjectId ?? null;

  let filteredProjects = projects;
  if (excludeArchived) {
    filteredProjects = filteredProjects.filter((p) => !p.is_archived);
  }
  if (selectedProjectId) {
    filteredProjects = filteredProjects.filter(
      (p) => p.id === selectedProjectId,
    );
  }

  const completedRuns = runs.filter(
    (r) => r.status === "completed" && r.progress,
  );

  const perProject: PerProjectPassRate[] = filteredProjects
    .map((project) => {
      const projectRuns = completedRuns.filter(
        (r) => r.project_id === project.id,
      );
      const runCount = projectRuns.length;
      const passRate =
        runCount > 0
          ? projectRuns.reduce(
              (sum, r) => sum + (r.progress?.pass_rate ?? 0),
              0,
            ) / runCount
          : null;

      return {
        projectId: project.id,
        name: project.name,
        passRate: passRate !== null ? Math.round(passRate * 10) / 10 : null,
        runCount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const withData = perProject.filter((p) => p.passRate !== null);
  const overall =
    withData.length > 0
      ? Math.round(
          (withData.reduce((sum, p) => sum + p.passRate!, 0) /
            withData.length) *
            10,
        ) / 10
      : null;

  return { overall, perProject };
}
