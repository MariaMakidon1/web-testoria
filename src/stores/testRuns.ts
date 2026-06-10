import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  TestRun,
  TestRunCreate,
  TestRunUpdate,
  TestRunProgress,
} from "@/types/testRun";
import * as testRunsApi from "@/api/testRuns";
import type { TestRunFilters } from "@/api/testRuns";

export const useTestRunsStore = defineStore("testRuns", () => {
  const testRuns = ref<TestRun[]>([]);
  const allRuns = ref<Record<number, TestRun[]>>({});
  const currentTestRun = ref<TestRun | null>(null);
  const currentProjectId = ref<number | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 0,
  });
  const filters = ref<TestRunFilters>({});

  // Get all runs across all projects (for dashboard aggregation)
  const allRunsFlat = computed(() => {
    return Object.values(allRuns.value).flat();
  });

  async function fetchTestRuns(projectId: number, newFilters?: TestRunFilters) {
    loading.value = true;
    error.value = null;
    currentProjectId.value = projectId;
    if (newFilters) {
      filters.value = { ...filters.value, ...newFilters };
    }

    try {
      const response = await testRunsApi.getTestRuns(projectId, {
        ...filters.value,
        page: pagination.value.page,
        page_size: pagination.value.page_size,
      });

      testRuns.value = response.items;
      pagination.value = {
        total: response.total,
        page: response.page,
        page_size: response.page_size,
        total_pages: response.total_pages,
      };
      allRuns.value[projectId] = response.items;
    } catch (e) {
      error.value = "Failed to load test runs";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTestRun(id: number) {
    loading.value = true;
    error.value = null;
    try {
      currentTestRun.value = await testRunsApi.getTestRun(id);
    } catch (e) {
      error.value = "Failed to load test run";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createTestRun(projectId: number, data: TestRunCreate) {
    error.value = null;
    const testRun = await testRunsApi.createTestRun(projectId, data);

    if (!allRuns.value[projectId]) {
      allRuns.value[projectId] = [];
    }
    allRuns.value[projectId].unshift(testRun);
    testRuns.value = allRuns.value[projectId];
    pagination.value.total = testRuns.value.length;

    return testRun;
  }

  async function updateTestRun(id: number, data: TestRunUpdate) {
    error.value = null;
    const updated = await testRunsApi.updateTestRun(id, data);
    const index = testRuns.value.findIndex((tr) => tr.id === id);
    if (index !== -1) {
      testRuns.value[index] = updated;
    }
    if (currentTestRun.value?.id === id) {
      currentTestRun.value = updated;
    }
    if (currentProjectId.value) {
      const projectRuns = allRuns.value[currentProjectId.value];
      if (projectRuns) {
        const idx = projectRuns.findIndex((tr) => tr.id === id);
        if (idx !== -1) {
          projectRuns[idx] = updated;
        }
      }
    }
    return updated;
  }

  async function deleteTestRun(id: number) {
    await testRunsApi.deleteTestRun(id);
    testRuns.value = testRuns.value.filter((tr) => tr.id !== id);
    pagination.value.total--;
    if (currentTestRun.value?.id === id) {
      currentTestRun.value = null;
    }
    if (currentProjectId.value) {
      allRuns.value[currentProjectId.value] =
        allRuns.value[currentProjectId.value]?.filter((tr) => tr.id !== id) ||
        [];
    }
  }

  async function setRunCases(id: number, caseIds: number[]) {
    error.value = null;
    const updated = await testRunsApi.setRunCases(id, caseIds);
    const index = testRuns.value.findIndex((tr) => tr.id === id);
    if (index !== -1) {
      testRuns.value[index] = { ...testRuns.value[index], ...updated };
    }
    if (currentTestRun.value?.id === id) {
      currentTestRun.value = { ...currentTestRun.value, ...updated };
    }
    if (currentProjectId.value) {
      const projectRuns = allRuns.value[currentProjectId.value];
      if (projectRuns) {
        const idx = projectRuns.findIndex((tr) => tr.id === id);
        if (idx !== -1) {
          projectRuns[idx] = { ...projectRuns[idx], ...updated };
        }
      }
    }
    return updated;
  }

  async function closeTestRun(id: number) {
    error.value = null;
    const closed = await testRunsApi.closeTestRun(id);
    const index = testRuns.value.findIndex((tr) => tr.id === id);
    if (index !== -1) {
      testRuns.value[index] = closed;
    }
    if (currentTestRun.value?.id === id) {
      currentTestRun.value = closed;
    }
    if (currentProjectId.value) {
      const projectRuns = allRuns.value[currentProjectId.value];
      if (projectRuns) {
        const idx = projectRuns.findIndex((tr) => tr.id === id);
        if (idx !== -1) {
          projectRuns[idx] = closed;
        }
      }
    }
    return closed;
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  function clearFilters() {
    filters.value = {};
    pagination.value.page = 1;
  }

  function clearCurrentTestRun() {
    currentTestRun.value = null;
  }

  // Optimistically flip a run's status in local state (used when the first
  // result submit promotes a `planned` run to `active`). The backend will
  // confirm shortly after via progress/refresh; if the optimistic update
  // disagrees with the server, the next fetch replaces this value.
  function setRunStatusOptimistic(runId: number, status: TestRun["status"]) {
    if (currentTestRun.value?.id === runId) {
      currentTestRun.value = { ...currentTestRun.value, status };
    }
    const listIdx = testRuns.value.findIndex((tr) => tr.id === runId);
    if (listIdx !== -1) {
      testRuns.value[listIdx] = { ...testRuns.value[listIdx], status };
    }
    for (const projectId of Object.keys(allRuns.value)) {
      const projectRuns = allRuns.value[Number(projectId)];
      const idx = projectRuns?.findIndex((tr) => tr.id === runId);
      if (idx !== undefined && idx !== -1 && projectRuns) {
        projectRuns[idx] = { ...projectRuns[idx], status };
      }
    }
  }

  async function fetchProgress(runId: number): Promise<TestRunProgress> {
    const progress = await testRunsApi.getTestRunProgress(runId);
    updateTestRunProgress(runId, progress);
    return progress;
  }

  function updateTestRunProgress(
    runId: number,
    incoming: TestRunProgress & { untested?: number },
  ) {
    // Fold any legacy `untested` field into `no_run` — the frontend only
    // tracks a single "not run" bucket.
    const { untested, ...rest } = incoming;
    const progress: TestRunProgress = {
      ...rest,
      no_run: (rest.no_run ?? 0) + (untested ?? 0),
    };
    const index = testRuns.value.findIndex((tr) => tr.id === runId);
    if (index !== -1) {
      testRuns.value[index] = { ...testRuns.value[index], progress };
    }
    if (currentTestRun.value?.id === runId) {
      currentTestRun.value = { ...currentTestRun.value, progress };
    }
    for (const projectId of Object.keys(allRuns.value)) {
      const projectRuns = allRuns.value[Number(projectId)];
      const idx = projectRuns?.findIndex((tr) => tr.id === runId);
      if (idx !== undefined && idx !== -1 && projectRuns) {
        projectRuns[idx] = { ...projectRuns[idx], progress };
        break;
      }
    }
  }

  // Fetch all runs across all projects (for dashboard)
  async function fetchAllRuns(projectIds: number[]) {
    loading.value = true;
    error.value = null;
    try {
      await Promise.all(
        projectIds.map(async (projectId) => {
          const response = await testRunsApi.getTestRuns(projectId, {
            page: 1,
            page_size: 20,
          });
          allRuns.value[projectId] = response.items;
        }),
      );
    } catch (e) {
      error.value = "Failed to load all test runs";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // Dashboard-scoped: fetch runs with progress populated (api plan 036 opt-in).
  async function fetchAllRunsForDashboard(projectIds: number[]) {
    loading.value = true;
    error.value = null;
    try {
      await Promise.all(
        projectIds.map(async (projectId) => {
          const response = await testRunsApi.getTestRuns(projectId, {
            page: 1,
            page_size: 20,
            include: "progress",
          });
          allRuns.value[projectId] = response.items;
        }),
      );
    } catch (e) {
      error.value = "Failed to load all test runs";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchRunsForDashboard(projectId: number) {
    loading.value = true;
    error.value = null;
    try {
      const response = await testRunsApi.getTestRuns(projectId, {
        page: 1,
        page_size: pagination.value.page_size,
        include: "progress",
      });
      allRuns.value[projectId] = response.items;
      testRuns.value = response.items;
    } catch (e) {
      error.value = "Failed to load test runs";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    testRuns,
    allRuns,
    allRunsFlat,
    currentTestRun,
    loading,
    error,
    pagination,
    filters,
    fetchTestRuns,
    fetchTestRun,
    fetchAllRuns,
    fetchAllRunsForDashboard,
    fetchRunsForDashboard,
    fetchProgress,
    createTestRun,
    updateTestRun,
    updateTestRunProgress,
    deleteTestRun,
    closeTestRun,
    setRunCases,
    setPage,
    clearFilters,
    clearCurrentTestRun,
    setRunStatusOptimistic,
  };
});
