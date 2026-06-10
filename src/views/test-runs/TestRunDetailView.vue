<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTestRunsStore } from "@/stores/testRuns";
import { useTestResultsStore } from "@/stores/testResults";
import { useTestSuitesStore } from "@/stores/testSuites";
import type { TestResult } from "@/types/testResult";
import { formatPassRate } from "@/utils/passRate";

import { RUN_STATUS_LABELS } from "@/types/testRun";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import TestResultsList from "@/components/test-runs/TestResultsList.vue";
import TestResultDetail from "@/components/test-runs/TestResultDetail.vue";
import EditTestRunDialog from "@/components/test-runs/EditTestRunDialog.vue";
import EditRunCasesDialog from "@/components/test-runs/EditRunCasesDialog.vue";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ConfirmDialog from "primevue/confirmdialog";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from "@/stores/auth";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";

const route = useRoute();
const router = useRouter();
const testRunsStore = useTestRunsStore();
const testResultsStore = useTestResultsStore();
const testSuitesStore = useTestSuitesStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const testRunId = Number(route.params.id);
const selectedResult = ref<TestResult | null>(null);
const showDetailPanel = ref(false);
const showEditDialog = ref(false);
const showEditCasesDialog = ref(false);
const isSavingComment = ref(false);
const resultDetailRef =
  ref<InstanceType<typeof TestResultDetail> | null>(null);

type UpdateCommentPayload = {
  comment: string;
  images: { id: string; file: File; name: string; size: number; preview: string }[];
};

async function handleUpdateComment(payload: UpdateCommentPayload) {
  const target = selectedResult.value;
  if (!target || target.id == null) return;
  const resultId = target.id;

  isSavingComment.value = true;
  try {
    let failed: { filename: string; reason: string }[] = [];
    if (payload.images.length > 0) {
      const files = payload.images.map((img) => img.file);
      const resp = await testResultsStore.uploadAttachmentsBulk(
        resultId,
        files,
      );
      failed = resp.failed;
    }
    await testResultsStore.updateResult(resultId, {
      comment: payload.comment || undefined,
    });
    if (payload.images.length > 0) {
      await testResultsStore.fetchRunCasesWithResults(testRunId);
    }
    if (failed.length > 0) {
      toast.add({
        severity: "warn",
        summary: "Saved with errors",
        detail: `${failed.length} attachment(s) failed: ${failed.map((f) => f.filename).join(", ")}`,
        life: 5000,
      });
    } else {
      toast.add({
        severity: "success",
        summary: "Comment saved",
        detail: "Your comment has been updated",
        life: 3000,
      });
    }
    resultDetailRef.value?.resetCommentEdit();
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Failed to save comment",
      detail: err.response?.data?.detail || "Please try again.",
      life: 5000,
    });
  } finally {
    isSavingComment.value = false;
  }
}

const runCaseIds = computed(() =>
  testResultsStore.runCases.map((c) => c.id),
);

const canEditCases = computed(() => {
  const run = testRunsStore.currentTestRun;
  return !!run && run.status !== "completed";
});

// Keep `selectedResult` aligned with the store after any refetch (e.g. after
// a defect add/remove triggers fetchRunCasesWithResults). Without this, the
// ref keeps pointing to the previous object reference and the detail panel
// renders stale data.
watch(
  () => testResultsStore.results,
  (newResults) => {
    if (!selectedResult.value) return;
    const match = newResults.find(
      (r) => r.test_case_id === selectedResult.value!.test_case_id,
    );
    if (match && match !== selectedResult.value) {
      selectedResult.value = match;
    }
  },
);

const runProgress = computed(
  () =>
    testRunsStore.currentTestRun?.progress ?? {
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      no_run: 0,
      pass_rate: 0,
    },
);

const canExecuteRun = computed(() => {
  const run = testRunsStore.currentTestRun;
  if (!run) return false;
  return !["completed", "aborted"].includes(run.status);
});

const selectedSuiteName = computed<string | null>(() => {
  const sel = selectedResult.value;
  if (!sel) return null;
  const runCase = testResultsStore.runCases.find(
    (c) => c.id === sel.test_case_id,
  );
  if (!runCase || runCase.suite_id == null) return null;
  const suite = testSuitesStore.testSuites.find(
    (s) => s.id === runCase.suite_id,
  );
  return suite?.name ?? null;
});

onMounted(async () => {
  await testRunsStore.fetchTestRun(testRunId);
  const projectId = testRunsStore.currentTestRun?.project_id;
  await Promise.all([
    testResultsStore.fetchRunCasesWithResults(testRunId),
    testRunsStore.fetchProgress(testRunId),
    projectId ? testSuitesStore.fetchTestSuites(projectId) : Promise.resolve(),
  ]);
});

function getStatusSeverity(status: string) {
  const map: Record<string, "success" | "info" | "warning" | "danger"> = {
    planned: "info",
    active: "warning",
    completed: "success",
    aborted: "danger",
  };
  return map[status] || "info";
}

function handleSelectResult(result: TestResult) {
  selectedResult.value = result;
  showDetailPanel.value = true;
  if (result.id != null) {
    testResultsStore.fetchHistory(result.id);
  }
}

function handleCloseDetail() {
  showDetailPanel.value = false;
  selectedResult.value = null;
}

function handleEditTestCase(result: TestResult) {
  router.push({
    name: "TestCaseEdit",
    params: { id: result.test_case_id },
  });
}

function handleExecuteResult(result: TestResult) {
  router.push(
    `/test-runs/${testRunId}/execute?testCaseId=${result.test_case_id}`,
  );
}

function confirmDelete() {
  const run = testRunsStore.currentTestRun;
  if (!run) return;
  confirm.require({
    message: `Are you sure you want to delete "${run.name}"? This will also delete all results in this run. This action cannot be undone.`,
    header: "Delete Test Run",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: () => handleDelete(),
    reject: () => {},
  });
}

async function handleDelete() {
  try {
    await testRunsStore.deleteTestRun(testRunId);
    toast.add({
      severity: "success",
      summary: "Deleted",
      detail: "Test run deleted successfully",
      life: 3000,
    });
    router.push("/test-runs");
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to delete test run",
      life: 5000,
    });
  }
}

</script>

<template>
  <DefaultLayout :fullHeight="true">
    <ConfirmDialog />
    <div
      class="test-run-detail-view"
      :class="{ 'detail-open': showDetailPanel }"
    >
      <!-- Header - Always visible but compact when detail is open -->
      <div class="page-header" :class="{ compact: showDetailPanel }">
        <div class="header-left">
          <Button
            icon="pi pi-arrow-left"
            text
            size="small"
            @click="router.push('/test-runs')"
            :label="showDetailPanel ? '' : 'Back to Test Runs'"
          />
          <h1 v-if="testRunsStore.currentTestRun">
            {{ testRunsStore.currentTestRun.name }}
          </h1>
          <Tag
            v-if="
              testRunsStore.currentTestRun?.cases_mode === 'explicit' &&
              !showDetailPanel
            "
            severity="secondary"
            value="Manual cases"
            class="manual-cases-badge"
            v-tooltip.bottom="
              'This run\'s case list was edited manually and no longer derives from a suite.'
            "
          />
        </div>
        <div v-if="authStore.canManageTests" class="header-actions">
          <Button
            v-if="canExecuteRun"
            data-testid="run-execute-btn"
            :label="showDetailPanel ? '' : 'Execute Tests'"
            icon="pi pi-play"
            :size="showDetailPanel ? 'small' : undefined"
            @click="router.push(`/test-runs/${testRunId}/execute`)"
          />
          <Button
            data-testid="run-edit-btn"
            :label="showDetailPanel ? '' : 'Edit Run'"
            icon="pi pi-pencil"
            :size="showDetailPanel ? 'small' : undefined"
            :disabled="!testRunsStore.currentTestRun"
            @click="showEditDialog = true"
          />
          <Button
            data-testid="run-edit-cases-btn"
            :label="showDetailPanel ? '' : 'Edit Cases'"
            icon="pi pi-list-check"
            outlined
            :size="showDetailPanel ? 'small' : undefined"
            :disabled="!canEditCases"
            v-tooltip.bottom="
              !canEditCases && testRunsStore.currentTestRun
                ? 'Completed runs cannot be edited'
                : undefined
            "
            @click="showEditCasesDialog = true"
          />
          <Button
            :label="showDetailPanel ? '' : 'Delete'"
            icon="pi pi-trash"
            severity="danger"
            outlined
            :size="showDetailPanel ? 'small' : undefined"
            @click="confirmDelete"
          />
        </div>
      </div>

      <!-- Compact stats when detail is open -->
      <div
        v-if="showDetailPanel && testRunsStore.currentTestRun"
        class="compact-stats"
      >
        <Tag
          :value="
            RUN_STATUS_LABELS[testRunsStore.currentTestRun.status] ||
            testRunsStore.currentTestRun.status
          "
          :severity="getStatusSeverity(testRunsStore.currentTestRun.status)"
        />
        <span class="compact-stat">
          <i class="pi pi-check-circle"></i>
          {{ formatPassRate(runProgress.pass_rate) }}
        </span>
        <span class="compact-stat">
          <i class="pi pi-list"></i>
          {{ runProgress.passed }}/{{ runProgress.total }}
        </span>
        <Button
          icon="pi pi-chevron-down"
          text
          rounded
          size="small"
          @click="handleCloseDetail"
          v-tooltip.bottom="'Show full stats'"
          class="expand-btn"
        />
      </div>

      <!-- Test Results Section -->
      <div class="results-section">
        <h2 class="section-title" v-if="!showDetailPanel">
          <i class="pi pi-list"></i>
          Test Results
        </h2>

        <div class="results-content">
          <Splitter
            v-if="showDetailPanel"
            class="results-splitter"
            :gutterSize="4"
          >
            <SplitterPanel :size="35" :minSize="25">
              <TestResultsList
                :results="testResultsStore.results"
                :selected-result="selectedResult"
                :loading="testResultsStore.loading"
                :run-progress="runProgress"
                :test-run="testRunsStore.currentTestRun"
                :run-cases="testResultsStore.runCases"
                :suite-tree="testSuitesStore.suiteTree"
                :can-edit-cases="authStore.canManageTests && canEditCases"
                @select="handleSelectResult"
                @edit-cases="showEditCasesDialog = true"
              />
            </SplitterPanel>
            <SplitterPanel :size="65" :minSize="40">
              <TestResultDetail
                ref="resultDetailRef"
                :result="selectedResult"
                :history="
                  selectedResult && selectedResult.id != null
                    ? (testResultsStore.history[selectedResult.id] ?? [])
                    : []
                "
                :suite-name="selectedSuiteName"
                :is-saving="isSavingComment"
                @close="handleCloseDetail"
                @edit-test-case="handleEditTestCase"
                @execute-result="handleExecuteResult"
                @update-comment="handleUpdateComment"
              />
            </SplitterPanel>
          </Splitter>

          <div v-else class="results-list-only">
            <TestResultsList
              :results="testResultsStore.results"
              :selected-result="selectedResult"
              :loading="testResultsStore.loading"
              :run-progress="runProgress"
              :test-run="testRunsStore.currentTestRun"
              :run-cases="testResultsStore.runCases"
              :suite-tree="testSuitesStore.suiteTree"
              @select="handleSelectResult"
            />
          </div>
        </div>
      </div>

      <EditTestRunDialog
        v-model:visible="showEditDialog"
        :test-run="testRunsStore.currentTestRun"
      />

      <EditRunCasesDialog
        v-if="testRunsStore.currentTestRun"
        v-model:visible="showEditCasesDialog"
        :run-id="testRunId"
        :project-id="testRunsStore.currentTestRun.project_id"
        :initial-selected-ids="runCaseIds"
      />
    </div>
  </DefaultLayout>
</template>

<style scoped>
.test-run-detail-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 16px;
  padding: 24px;
  overflow: hidden;
}

.test-run-detail-view.detail-open {
  gap: 8px;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.page-header.compact {
  padding-bottom: 0;
}

.page-header.compact h1 {
  font-size: 1.125rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  transition: font-size 0.2s ease;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Run Info Section - Responsive Stats Bar */
.run-info-section {
  flex-shrink: 0;
  overflow: hidden;
}

.run-info-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 16px;
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px 8px 0 0;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 80px;
}

.stat-item.highlight {
  padding: 4px 12px;
  background-color: var(--highlight-bg);
  border-radius: 6px;
}

.stat-item.progress-stat {
  flex: 1;
  min-width: 150px;
  max-width: 300px;
}

.stat-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.pass-rate {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--primary-600, #5a6fd6);
}

.progress-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flex-1 {
  flex: 1;
  min-width: 80px;
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

/* Compact Stats - shown when detail panel is open */
.compact-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 12px;
  background-color: var(--surface-hover);
  border-radius: 6px;
  flex-wrap: wrap;
}

.compact-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.compact-stat i {
  font-size: 0.75rem;
  color: var(--primary-500, #667eea);
}

.expand-btn {
  margin-left: auto;
}

/* Collapse Transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  max-height: 100px;
  opacity: 1;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
  margin: 0;
  padding: 0;
}

/* Results Section */
.results-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 12px 0;
}

.section-title i {
  color: var(--primary-500, #667eea);
}

.results-content {
  flex: 1;
  display: flex;
  min-height: 0;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--surface-card);
}

.results-splitter {
  width: 100%;
  height: 100%;
}

.results-splitter :deep(.p-splitter-panel) {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.results-splitter :deep(.p-splitter-gutter) {
  background-color: var(--surface-border);
}

.results-splitter :deep(.p-splitter-gutter:hover) {
  background-color: var(--primary-300, #a5aefc);
}

.results-list-only {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Responsive Breakpoints */
@media (max-width: 1024px) {
  .run-info-bar {
    gap: 16px;
  }

  .stat-item.progress-stat {
    flex-basis: 100%;
    max-width: none;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-left {
    width: 100%;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .run-info-bar {
    gap: 12px;
    padding: 10px 12px;
  }

  .stat-item {
    min-width: 70px;
  }

  .stat-item.highlight {
    padding: 4px 8px;
  }

  .pass-rate {
    font-size: 1rem;
  }

  /* Stack splitter vertically on mobile */
  .results-splitter {
    flex-direction: column !important;
  }

  .results-splitter :deep(.p-splitter-gutter) {
    height: 4px !important;
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .test-run-detail-view {
    gap: 8px;
  }

  .page-header h1 {
    font-size: 1.125rem;
  }

  .run-info-bar {
    gap: 8px;
    padding: 8px;
  }

  .stat-item {
    min-width: 60px;
  }

  .stat-label {
    font-size: 0.6rem;
  }

  .stat-value {
    font-size: 0.75rem;
  }

  .compact-stats {
    gap: 8px;
    padding: 4px 8px;
  }

  .compact-stat {
    font-size: 0.7rem;
  }
}

/* Status breakdown */
.status-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 16px;
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
}

.breakdown-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.breakdown-label {
  color: var(--text-color-secondary);
}

.breakdown-count {
  font-weight: 600;
  color: var(--text-color);
}
</style>
