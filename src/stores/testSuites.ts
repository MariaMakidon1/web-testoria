import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  TestSuite,
  TestSuiteCreate,
  TestSuiteUpdate,
  TestSuiteTree,
} from "@/types/testSuite";
import * as testSuitesApi from "@/api/testSuites";
import { useUIStore } from "@/stores/ui";

export const useTestSuitesStore = defineStore("testSuites", () => {
  const testSuites = ref<TestSuite[]>([]);
  const currentSuite = ref<TestSuite | null>(null);
  const currentProjectId = ref<number | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Build tree structure from flat list. Sort siblings by
  // (display_order NULLS LAST, name) — matches the backend's
  // `apply_suite_order` so reorder via drag-and-drop is reflected
  // immediately and stays consistent on refetch.
  const suiteTree = computed<TestSuiteTree[]>(() => {
    const buildTree = (
      parentId: number | null,
      level: number,
    ): TestSuiteTree[] => {
      return testSuites.value
        .filter((s) => s.parent_suite_id === parentId)
        .sort((a, b) => {
          const ao = a.display_order;
          const bo = b.display_order;
          if (ao == null && bo == null) return a.name.localeCompare(b.name);
          if (ao == null) return 1;
          if (bo == null) return -1;
          if (ao !== bo) return ao - bo;
          return a.name.localeCompare(b.name);
        })
        .map((suite) => ({
          ...suite,
          level,
          expanded: true,
          children: buildTree(suite.id, level + 1),
        }));
    };
    return buildTree(null, 0);
  });

  // Flat list with level info for tree display
  const flatTreeList = computed<TestSuiteTree[]>(() => {
    const flatten = (nodes: TestSuiteTree[]): TestSuiteTree[] => {
      return nodes.reduce((acc: TestSuiteTree[], node) => {
        acc.push(node);
        if (node.expanded && node.children.length > 0) {
          acc.push(...flatten(node.children));
        }
        return acc;
      }, []);
    };
    return flatten(suiteTree.value);
  });

  async function fetchTestSuites(projectId: number) {
    loading.value = true;
    error.value = null;
    currentProjectId.value = projectId;
    try {
      testSuites.value = await testSuitesApi.getTestSuites(projectId);
    } catch (e) {
      error.value = "Failed to load test suites";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTestSuite(id: number) {
    loading.value = true;
    error.value = null;
    try {
      currentSuite.value = await testSuitesApi.getTestSuite(id);
    } catch (e) {
      error.value = "Failed to load test suite";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createTestSuite(projectId: number, data: TestSuiteCreate) {
    error.value = null;
    const suite = await testSuitesApi.createTestSuite(projectId, data);
    testSuites.value.push(suite);
    return suite;
  }

  async function updateTestSuite(id: number, data: TestSuiteUpdate) {
    error.value = null;
    const updated = await testSuitesApi.updateTestSuite(id, data);
    const index = testSuites.value.findIndex((s) => s.id === id);
    if (index !== -1) {
      testSuites.value[index] = updated;
    }
    if (currentSuite.value?.id === id) {
      currentSuite.value = updated;
    }
    return updated;
  }

  async function reorderTestSuite(id: number, newDisplayOrder: number) {
    error.value = null;
    const index = testSuites.value.findIndex((s) => s.id === id);
    if (index === -1) return;
    const previous = testSuites.value[index];
    testSuites.value[index] = { ...previous, display_order: newDisplayOrder };
    try {
      const updated = await testSuitesApi.updateTestSuite(id, {
        display_order: newDisplayOrder,
      });
      const next = testSuites.value.findIndex((s) => s.id === id);
      if (next !== -1) testSuites.value[next] = updated;
    } catch (e) {
      const revertAt = testSuites.value.findIndex((s) => s.id === id);
      if (revertAt !== -1) testSuites.value[revertAt] = previous;
      error.value = "Failed to reorder suite";
      throw e;
    }
  }

  async function deleteTestSuite(id: number) {
    await testSuitesApi.deleteTestSuite(id);
    testSuites.value = testSuites.value.filter((s) => s.id !== id);
    if (currentSuite.value?.id === id) {
      currentSuite.value = null;
    }
    useUIStore().clearSuiteExpandState(id);
  }

  function getSuiteById(id: number): TestSuite | undefined {
    return testSuites.value.find((s) => s.id === id);
  }

  function clearTestSuites() {
    testSuites.value = [];
    currentSuite.value = null;
  }

  return {
    testSuites,
    currentSuite,
    loading,
    error,
    suiteTree,
    flatTreeList,
    fetchTestSuites,
    fetchTestSuite,
    createTestSuite,
    updateTestSuite,
    reorderTestSuite,
    deleteTestSuite,
    getSuiteById,
    clearTestSuites,
  };
});
