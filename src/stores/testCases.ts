import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  TestCase,
  TestCaseCreate,
  TestCaseUpdate,
} from "@/types/testCase";
import * as testCasesApi from "@/api/testCases";
import type { TestCaseFilters } from "@/api/testCases";

export const useTestCasesStore = defineStore("testCases", () => {
  const testCases = ref<TestCase[]>([]);
  const allCases = ref<Record<number, TestCase[]>>({});
  const casesBySuite = ref<Record<number, TestCase[]>>({});
  const currentTestCase = ref<TestCase | null>(null);
  const currentProjectId = ref<number | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 0,
  });
  const filters = ref<TestCaseFilters>({});

  // Get all test cases across all projects (for dashboard aggregation)
  const allCasesFlat = computed(() => {
    return Object.values(allCases.value).flat();
  });

  // Get test cases for a specific project from cache
  function getProjectCases(projectId: number): TestCase[] {
    return allCases.value[projectId] || [];
  }

  async function fetchTestCases(
    projectId: number,
    newFilters?: TestCaseFilters,
  ) {
    loading.value = true;
    error.value = null;
    currentProjectId.value = projectId;
    if (newFilters) {
      filters.value = { ...filters.value, ...newFilters };
    }

    try {
      const response = await testCasesApi.getTestCases(projectId, {
        ...filters.value,
        page: pagination.value.page,
        page_size: pagination.value.page_size,
      });

      testCases.value = response.items;
      pagination.value = {
        total: response.total,
        page: response.page,
        page_size: response.page_size,
        total_pages: response.total_pages,
      };
      allCases.value[projectId] = response.items;
    } catch (e) {
      error.value = "Failed to load test cases";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTestCase(id: number) {
    loading.value = true;
    error.value = null;
    try {
      currentTestCase.value = await testCasesApi.getTestCase(id);
    } catch (e) {
      error.value = "Failed to load test case";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createTestCase(projectId: number, data: TestCaseCreate) {
    error.value = null;
    const testCase = await testCasesApi.createTestCase(projectId, data);

    if (!allCases.value[projectId]) {
      allCases.value[projectId] = [];
    }
    allCases.value[projectId].unshift(testCase);
    testCases.value = allCases.value[projectId];
    pagination.value.total = testCases.value.length;

    return testCase;
  }

  async function updateTestCase(id: number, data: TestCaseUpdate) {
    error.value = null;
    const updated = await testCasesApi.updateTestCase(id, data);
    const index = testCases.value.findIndex((tc) => tc.id === id);
    if (index !== -1) {
      testCases.value[index] = updated;
    }
    if (currentTestCase.value?.id === id) {
      currentTestCase.value = updated;
    }
    if (currentProjectId.value) {
      const projectCases = allCases.value[currentProjectId.value];
      if (projectCases) {
        const idx = projectCases.findIndex((tc) => tc.id === id);
        if (idx !== -1) {
          projectCases[idx] = updated;
        }
      }
    }
    return updated;
  }

  async function reorderTestCase(
    id: number,
    suiteId: number,
    newDisplayOrder: number,
  ) {
    error.value = null;

    // Snapshot every list that might hold this case so a rollback restores
    // them all in lockstep.
    const previousBySuite = casesBySuite.value[suiteId]?.slice();
    const previousTestCases = testCases.value.slice();
    const previousAllCases = currentProjectId.value
      ? allCases.value[currentProjectId.value]?.slice()
      : undefined;

    const stamp = <T extends { id: number; display_order?: number | null }>(
      arr: T[] | undefined,
    ): T[] | undefined => {
      if (!arr) return arr;
      const idx = arr.findIndex((tc) => tc.id === id);
      if (idx === -1) return arr;
      const next = [...arr];
      next[idx] = { ...next[idx], display_order: newDisplayOrder };
      return next;
    };

    if (previousBySuite) {
      casesBySuite.value[suiteId] = (stamp(previousBySuite) ?? []).sort(
        _sortByDisplayOrder,
      );
    }
    testCases.value = stamp(previousTestCases) ?? previousTestCases;
    if (currentProjectId.value && previousAllCases) {
      allCases.value[currentProjectId.value] =
        stamp(previousAllCases) ?? previousAllCases;
    }

    try {
      const updated = await testCasesApi.updateTestCase(id, {
        display_order: newDisplayOrder,
      });
      const replace = <T extends { id: number }>(
        arr: T[] | undefined,
      ): T[] | undefined => {
        if (!arr) return arr;
        const idx = arr.findIndex((tc) => tc.id === id);
        if (idx === -1) return arr;
        const next = [...arr];
        next[idx] = updated as unknown as T;
        return next;
      };
      const nextBySuite = replace(casesBySuite.value[suiteId]);
      if (nextBySuite) {
        casesBySuite.value[suiteId] = nextBySuite.sort(_sortByDisplayOrder);
      }
      testCases.value = replace(testCases.value) ?? testCases.value;
      if (currentProjectId.value) {
        const refreshed = replace(allCases.value[currentProjectId.value]);
        if (refreshed) allCases.value[currentProjectId.value] = refreshed;
      }
    } catch (e) {
      if (previousBySuite) casesBySuite.value[suiteId] = previousBySuite;
      testCases.value = previousTestCases;
      if (currentProjectId.value && previousAllCases) {
        allCases.value[currentProjectId.value] = previousAllCases;
      }
      error.value = "Failed to reorder test case";
      throw e;
    }
  }

  function _sortByDisplayOrder(a: TestCase, b: TestCase): number {
    const ao = a.display_order;
    const bo = b.display_order;
    if (ao == null && bo == null) return a.id - b.id;
    if (ao == null) return 1;
    if (bo == null) return -1;
    if (ao !== bo) return ao - bo;
    return a.id - b.id;
  }

  async function deleteTestCase(id: number) {
    await testCasesApi.deleteTestCase(id);
    testCases.value = testCases.value.filter((tc) => tc.id !== id);
    pagination.value.total--;
    if (currentTestCase.value?.id === id) {
      currentTestCase.value = null;
    }
    if (currentProjectId.value) {
      allCases.value[currentProjectId.value] =
        allCases.value[currentProjectId.value]?.filter((tc) => tc.id !== id) ||
        [];
    }
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  function setPageSize(size: number) {
    pagination.value.page_size = size;
    pagination.value.page = 1;
  }

  async function fetchTestCasesBySuite(
    projectId: number,
    suiteId: number,
  ): Promise<TestCase[]> {
    if (casesBySuite.value[suiteId]) {
      return casesBySuite.value[suiteId];
    }
    const PAGE_SIZE = 100;
    const first = await testCasesApi.getTestCases(projectId, {
      suite_id: suiteId,
      page: 1,
      page_size: PAGE_SIZE,
    });
    let items = first.items;
    if (first.total_pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: first.total_pages - 1 }, (_, i) =>
          testCasesApi.getTestCases(projectId, {
            suite_id: suiteId,
            page: i + 2,
            page_size: PAGE_SIZE,
          }),
        ),
      );
      items = items.concat(...rest.map((r) => r.items));
    }
    casesBySuite.value[suiteId] = items;
    return items;
  }

  // Force-refresh the cached cases for a suite. Bypasses the cache guard in
  // `fetchTestCasesBySuite` so a call site that needs the freshest data
  // (e.g. a dialog reopen after changes elsewhere) always hits the backend.
  async function refreshCasesBySuite(
    projectId: number,
    suiteId: number,
  ): Promise<TestCase[]> {
    const PAGE_SIZE = 100;
    const first = await testCasesApi.getTestCases(projectId, {
      suite_id: suiteId,
      page: 1,
      page_size: PAGE_SIZE,
    });
    let items = first.items;
    if (first.total_pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: first.total_pages - 1 }, (_, i) =>
          testCasesApi.getTestCases(projectId, {
            suite_id: suiteId,
            page: i + 2,
            page_size: PAGE_SIZE,
          }),
        ),
      );
      items = items.concat(...rest.map((r) => r.items));
    }
    casesBySuite.value[suiteId] = items;
    return items;
  }

  function clearCasesBySuite() {
    casesBySuite.value = {};
  }

  function setFilters(newFilters: TestCaseFilters) {
    filters.value = { ...filters.value, ...newFilters };
    pagination.value.page = 1;
  }

  function clearFilters() {
    filters.value = {};
    pagination.value.page = 1;
  }

  function clearCurrentTestCase() {
    currentTestCase.value = null;
  }

  // Fetch all test cases across all projects (for dashboard)
  async function fetchAllCases(projectIds: number[]) {
    loading.value = true;
    error.value = null;
    try {
      await Promise.all(
        projectIds.map(async (projectId) => {
          const response = await testCasesApi.getTestCases(projectId, {
            page: 1,
            page_size: 20,
          });
          allCases.value[projectId] = response.items;
        }),
      );
    } catch (e) {
      error.value = "Failed to load all test cases";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    testCases,
    allCases,
    allCasesFlat,
    currentTestCase,
    loading,
    error,
    pagination,
    filters,
    casesBySuite,
    fetchTestCases,
    fetchTestCase,
    fetchAllCases,
    fetchTestCasesBySuite,
    refreshCasesBySuite,
    getProjectCases,
    createTestCase,
    updateTestCase,
    reorderTestCase,
    deleteTestCase,
    setPage,
    setPageSize,
    setFilters,
    clearFilters,
    clearCurrentTestCase,
    clearCasesBySuite,
  };
});
