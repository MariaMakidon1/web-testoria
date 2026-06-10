<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ProgressSpinner from "primevue/progressspinner";
import { useToast } from "primevue/usetoast";
import TestSuiteTreeSelector from "@/components/test-cases/TestSuiteTreeSelector.vue";
import { useTestRunsStore } from "@/stores/testRuns";
import { useTestSuitesStore } from "@/stores/testSuites";
import { useTestCasesStore } from "@/stores/testCases";
import { useTestResultsStore } from "@/stores/testResults";

const props = defineProps<{
  visible: boolean;
  runId: number;
  projectId: number;
  initialSelectedIds: number[];
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "saved", caseIds: number[]): void;
}>();

const testRunsStore = useTestRunsStore();
const testSuitesStore = useTestSuitesStore();
const testCasesStore = useTestCasesStore();
const testResultsStore = useTestResultsStore();
const toast = useToast();

const selectedCaseIds = ref<Set<number>>(new Set());
const selectedSuiteIds = ref<Set<number>>(new Set());
const loadingSuiteIds = ref<Set<number>>(new Set());
const loadingTree = ref(false);
const saving = ref(false);

const summaryText = computed(() => {
  const count = selectedCaseIds.value.size;
  return `${count} test case${count !== 1 ? "s" : ""} selected`;
});

const hasNoSuites = computed(() => testSuitesStore.testSuites.length === 0);

// Always refetch on open so the dialog reflects the latest suites/cases,
// even if they changed in another tab or session. The per-suite cache is
// bypassed via `refreshCasesBySuite` — on-demand expansion (`handleExpandSuite`)
// can still rely on the cache once this initial fan-out has seeded it.
async function loadAllSuiteCases() {
  loadingTree.value = true;
  try {
    await testSuitesStore.fetchTestSuites(props.projectId);
    const suites = testSuitesStore.testSuites;
    await Promise.all(
      suites.map((s) =>
        testCasesStore.refreshCasesBySuite(props.projectId, s.id),
      ),
    );
  } finally {
    loadingTree.value = false;
  }
}

// Any initial selection ids that no longer correspond to an existing case
// (e.g. a teammate deleted the case) are silently pruned; a warning toast
// surfaces the drop so the user knows their selection was trimmed.
function pruneStaleSelections() {
  const validIds = new Set<number>();
  for (const list of Object.values(testCasesStore.casesBySuite)) {
    for (const tc of list) validIds.add(tc.id);
  }
  const before = selectedCaseIds.value.size;
  const next = new Set<number>();
  for (const id of selectedCaseIds.value) {
    if (validIds.has(id)) next.add(id);
  }
  if (next.size < before) {
    const dropped = before - next.size;
    selectedCaseIds.value = next;
    toast.add({
      severity: "warn",
      summary: "Selection updated",
      detail: `${dropped} previously selected case${dropped !== 1 ? "s" : ""} no longer exist${dropped === 1 ? "s" : ""} and ${dropped !== 1 ? "were" : "was"} removed from the selection.`,
      life: 5000,
    });
  }
}

async function handleExpandSuite(suiteId: number) {
  if (testCasesStore.casesBySuite[suiteId]) return;
  loadingSuiteIds.value = new Set([...loadingSuiteIds.value, suiteId]);
  try {
    await testCasesStore.fetchTestCasesBySuite(props.projectId, suiteId);
  } finally {
    const next = new Set(loadingSuiteIds.value);
    next.delete(suiteId);
    loadingSuiteIds.value = next;
  }
}

watch(
  () => props.visible,
  async (isVisible) => {
    if (!isVisible) return;
    selectedCaseIds.value = new Set(props.initialSelectedIds);
    selectedSuiteIds.value = new Set();
    await loadAllSuiteCases();
    pruneStaleSelections();
  },
  { immediate: true },
);

function close() {
  emit("update:visible", false);
}

async function handleSave() {
  saving.value = true;
  const ids = [...selectedCaseIds.value];
  try {
    await testRunsStore.setRunCases(props.runId, ids);
    await Promise.all([
      testResultsStore.fetchRunCasesWithResults(props.runId),
      testRunsStore.fetchProgress(props.runId),
    ]);
    toast.add({
      severity: "success",
      summary: "Updated",
      detail: "Test run cases updated",
      life: 3000,
    });
    emit("saved", ids);
    close();
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to update run cases",
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Edit Run Cases"
    :modal="true"
    :style="{ width: '720px', maxWidth: '95vw' }"
    :closable="!saving"
    :dismissable-mask="!saving"
  >
    <div class="dialog-body">
      <div class="selection-summary">
        <Tag severity="info" :value="summaryText" />
      </div>

      <div class="tree-container">
        <div v-if="loadingTree" class="loading-state">
          <ProgressSpinner style="width: 40px; height: 40px" />
        </div>
        <div v-else-if="hasNoSuites" class="empty-state">
          No test suites available in this project.
        </div>
        <TestSuiteTreeSelector
          v-else
          :suites="testSuitesStore.suiteTree"
          :cases-by-suite="testCasesStore.casesBySuite"
          :selected-case-ids="selectedCaseIds"
          :selected-suite-ids="selectedSuiteIds"
          :loading-suite-ids="loadingSuiteIds"
          @update:selected-case-ids="selectedCaseIds = $event"
          @update:selected-suite-ids="selectedSuiteIds = $event"
          @expand-suite="handleExpandSuite"
        />
      </div>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        text
        :disabled="saving"
        @click="close"
        data-testid="edit-cases-cancel"
      />
      <Button
        label="Save"
        icon="pi pi-check"
        :loading="saving"
        :disabled="saving || loadingTree"
        @click="handleSave"
        data-testid="edit-cases-save"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

.selection-summary {
  display: flex;
  align-items: center;
}

.tree-container {
  max-height: 55vh;
  overflow-y: auto;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background-color: var(--surface-ground);
  padding: 4px;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}
</style>
