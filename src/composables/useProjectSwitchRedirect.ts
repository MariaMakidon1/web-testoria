import { watch } from "vue";
import {
  useRoute,
  useRouter,
  type RouteLocationNormalizedLoaded,
  type RouteLocationRaw,
} from "vue-router";
import { storeToRefs } from "pinia";
import { useProjectsStore } from "@/stores/projects";

const TEST_RUNS_ROUTES = new Set([
  "TestRunDetail",
  "TestRunExecution",
  "TestRunCreate",
]);

const PROJECT_SCOPED_CASE_ROUTES = new Set([
  "TestCaseDetail",
  "TestCaseEdit",
  "TestCases",
]);

export function redirectTargetForSwitch(
  route: Pick<RouteLocationNormalizedLoaded, "name" | "params">,
  newProjectId: number | null,
): RouteLocationRaw | null {
  const name = typeof route.name === "string" ? route.name : null;
  if (!name) return null;

  if (TEST_RUNS_ROUTES.has(name)) {
    return { name: "TestRuns" };
  }

  if (PROJECT_SCOPED_CASE_ROUTES.has(name)) {
    if (newProjectId == null) return null;
    if (
      name === "TestCases" &&
      Number(route.params.projectId) === newProjectId
    ) {
      return null;
    }
    return {
      name: "TestCases",
      params: { projectId: String(newProjectId) },
    };
  }

  return null;
}

export function useProjectSwitchRedirect() {
  const route = useRoute();
  const router = useRouter();
  const projectsStore = useProjectsStore();
  const { selectedProjectId } = storeToRefs(projectsStore);

  watch(selectedProjectId, (newId, oldId) => {
    if (newId === oldId) return;
    const target = redirectTargetForSwitch(route, newId);
    if (!target) return;
    router.replace(target).catch((failure) => {
      if (failure && typeof failure === "object" && "type" in failure) {
        projectsStore.setSelectedProject(oldId ?? null);
      }
    });
  });
}
