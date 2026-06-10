<script setup lang="ts">
import { onMounted, ref, computed, watch, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTestRunsStore } from "@/stores/testRuns";
import { useTestSuitesStore } from "@/stores/testSuites";
import { useTestResultsStore } from "@/stores/testResults";
import { useToast } from "primevue/usetoast";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import { RUN_STATUS_LABELS } from "@/types/testRun";
import TestRunProgressBar from "@/components/test-runs/TestRunProgressBar.vue";
import Textarea from "primevue/textarea";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";
import Divider from "primevue/divider";
import StepStatusPicker from "@/components/test-runs/StepStatusPicker.vue";
import SuiteTreeResults from "@/components/test-runs/SuiteTreeResults.vue";
import type { TestCase } from "@/types/testCase";
import { PRIORITY_LABELS, getPrioritySeverity } from "@/types/testCase";
import type { ResultStatus } from "@/types/testResult";
import {
  RESULT_STATUSES,
  RESULT_STATUS_LABELS,
} from "@/types/testResult";
import { suggestOverallStatus } from "@/composables/useOverallStatusSuggestion";
import { formatPassRate } from "@/utils/passRate";

const route = useRoute();
const router = useRouter();
const testRunsStore = useTestRunsStore();
const testSuitesStore = useTestSuitesStore();
const testResultsStore = useTestResultsStore();
const toast = useToast();

const testRunId = Number(route.params.id);

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

// Image upload interface
interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
  isExisting?: boolean; // Flag for images already saved to backend
}

// Current execution state
const selectedTestCase = ref<TestCase | null>(null);
const currentComment = ref("");
const currentDefectKey = ref("");
const currentImages = ref<UploadedImage[]>([]);
const isSubmitting = ref(false);
const isSaving = ref(false);
// Template ref for the shared <SuiteTreeResults> — used to query the DFS
// "next untested" case after a submit so auto-advance walks in render order.
const suiteTreeRef = ref<{
  findNextUntestedAfter: (caseId: number | null) => TestCase | null;
} | null>(null);

function normaliseString(value: string | null | undefined): string {
  return value ?? "";
}

function parseExistingAttachmentId(id: string): number | null {
  const m = /^existing_(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

// Sort-normalise two step-result lists before comparing so a backend-returned
// array in a different order doesn't look dirty. Comments coerce to "" so
// null/undefined/"" all compare equal.
function stepDraftDiffersFromResult(
  draft: { index: number; status: ResultStatus; comment?: string | null }[],
  existing: { index: number; status: ResultStatus; comment?: string | null }[] | null | undefined,
): boolean {
  const normalise = (list: typeof draft) =>
    [...list]
      .sort((a, b) => a.index - b.index)
      .map((r) => ({
        index: r.index,
        status: r.status,
        comment: r.comment ?? "",
      }));
  const a = normalise(draft);
  const b = normalise(existing ?? []);
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].index !== b[i].index ||
      a[i].status !== b[i].status ||
      a[i].comment !== b[i].comment
    ) {
      return true;
    }
  }
  return false;
}

const commentPanelIsDirty = computed(() => {
  if (!selectedTestCase.value) return false;
  const existing = testResultsStore.getResultByTestCaseId(
    selectedTestCase.value.id,
  );

  const persistedComment = normaliseString(existing?.comment);
  if (normaliseString(currentComment.value) !== persistedComment) return true;

  const persistedDefectKey = normaliseString(existing?.defects?.[0]?.key);
  if (normaliseString(currentDefectKey.value) !== persistedDefectKey)
    return true;

  const existingAttachmentIds = new Set(
    (existing?.attachments ?? [])
      .filter((a) => a.mime_type?.startsWith("image/"))
      .map((a) => a.id),
  );
  for (const img of currentImages.value) {
    if (!img.isExisting) return true; // new upload pending
    const backendId = parseExistingAttachmentId(img.id);
    if (backendId != null) existingAttachmentIds.delete(backendId);
  }
  // Anything left in the set was removed from currentImages.
  if (existingAttachmentIds.size > 0) return true;

  const draft = testResultsStore.getStepResultsDraftForCase(
    selectedTestCase.value.id,
  );
  if (stepDraftDiffersFromResult(draft, existing?.step_results)) return true;

  return false;
});

async function syncCurrentImages(resultId: number) {
  if (!selectedTestCase.value) return;
  const existing = testResultsStore.getResultByTestCaseId(
    selectedTestCase.value.id,
  );
  const remaining = new Set(
    (existing?.attachments ?? []).map((a) => a.id),
  );
  const toDelete: number[] = [];
  const toUpload: File[] = [];
  for (const img of currentImages.value) {
    if (img.isExisting) {
      const backendId = parseExistingAttachmentId(img.id);
      if (backendId != null) remaining.delete(backendId);
    } else if (img.file) {
      toUpload.push(img.file);
    }
  }
  toDelete.push(...remaining);

  const failures: string[] = [];
  // Deletes run in parallel; uploads go through the single bulk endpoint so
  // the server persists all files atomically and we avoid fan-out traffic.
  const deletePromises = toDelete.map((id) =>
    testResultsStore
      .deleteAttachment(resultId, id)
      .catch(() => failures.push(`delete ${id}`)),
  );
  let bulkPromise: Promise<void> = Promise.resolve();
  if (toUpload.length > 0) {
    bulkPromise = testResultsStore
      .uploadAttachmentsBulk(resultId, toUpload)
      .then((resp) => {
        for (const failed of resp.failed) {
          failures.push(`upload ${failed.filename}: ${failed.reason}`);
        }
      })
      .catch(() => {
        for (const file of toUpload) {
          failures.push(`upload ${file.name}`);
        }
      });
  }
  await Promise.all([...deletePromises, bulkPromise]);
  return failures;
}

const suggestedStatus = computed<ResultStatus | null>(() => {
  if (!selectedTestCase.value) return null;
  const draft = testResultsStore.getStepResultsDraftForCase(
    selectedTestCase.value.id,
  );
  return suggestOverallStatus(draft, selectedTestCase.value.steps?.length ?? 0);
});
const isDragging = ref(false);
const commentAreaRef = ref<HTMLElement | null>(null);

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const canAddMoreImages = computed(
  () => currentImages.value.length < MAX_IMAGES,
);

// Filter for test case list
const statusFilter = ref<ResultStatus | "all">("all");

// Test cases that belong to this run (sourced from
// GET /test-runs/:id/cases via testResultsStore.fetchRunCasesWithResults)
const testCases = computed(() => testResultsStore.runCases);

// Filtered test cases based on status filter
const filteredTestCases = computed(() => {
  if (statusFilter.value === "all") return testCases.value;
  return testCases.value.filter((tc) => {
    const result = testResultsStore.getResultByTestCaseId(tc.id);
    return result?.status === statusFilter.value;
  });
});

// The shared <SuiteTreeResults> component owns the grouped rendering,
// per-suite counts, collapse-state persistence, and per-row status/color
// lookups — see `src/components/test-runs/SuiteTreeResults.vue`.

// Still used by the selected-case header band.
function getSuiteName(suiteId: number | null | undefined): string {
  if (suiteId == null) return "-";
  const suite = testSuitesStore.testSuites.find((s) => s.id === suiteId);
  return suite?.name || "-";
}

// Select a test case for execution
function handleStepStatusChange(index: number, status: ResultStatus | null) {
  if (!selectedTestCase.value) return;
  if (status) {
    testResultsStore.setStepStatus(selectedTestCase.value.id, index, status);
  } else {
    testResultsStore.clearStep(selectedTestCase.value.id, index);
  }
}

function handleStepCommentChange(index: number, comment: string) {
  if (!selectedTestCase.value) return;
  testResultsStore.setStepComment(selectedTestCase.value.id, index, comment);
}

function getStepDraftStatus(index: number): ResultStatus | undefined {
  if (!selectedTestCase.value) return undefined;
  const draft = testResultsStore.getStepResultsDraftForCase(
    selectedTestCase.value.id,
  );
  return draft.find((r) => r.index === index)?.status;
}

function getStepDraftComment(index: number): string | null | undefined {
  if (!selectedTestCase.value) return undefined;
  const draft = testResultsStore.getStepResultsDraftForCase(
    selectedTestCase.value.id,
  );
  return draft.find((r) => r.index === index)?.comment;
}

// The suite-tree emits case ids; look up the case in the already-loaded
// run case list and delegate to selectTestCase.
function handleCaseTreeSelect(caseId: number) {
  const tc = testResultsStore.runCases.find((c) => c.id === caseId);
  if (tc) selectTestCase(tc);
}

function selectTestCase(testCase: TestCase) {
  selectedTestCase.value = testCase;

  const existingResult = testResultsStore.getResultByTestCaseId(testCase.id);
  if (existingResult) {
    testResultsStore.hydrateFromResult(testCase.id, existingResult);
  } else if (!testResultsStore.stepResultsDraft[testCase.id]) {
    testResultsStore.hydrateFromResult(testCase.id, {
      step_results: null,
    } as never);
  }
  if (existingResult) {
    currentComment.value = existingResult.comment || "";
    if (existingResult.defects && existingResult.defects.length > 0) {
      currentDefectKey.value = existingResult.defects[0].key || "";
    } else {
      currentDefectKey.value = "";
    }
    // Load existing attachments as images
    if (existingResult.attachments && existingResult.attachments.length > 0) {
      currentImages.value = existingResult.attachments
        .filter((a) => a.mime_type?.startsWith("image/"))
        .map(
          (a) =>
            ({
              id: `existing_${a.id}`,
              file: new File([], a.filename), // Placeholder file
              preview: a.url,
              name: a.filename,
              size: a.file_size,
              isExisting: true,
            }) as UploadedImage & { isExisting?: boolean },
        );
    } else {
      currentImages.value = [];
    }
  } else {
    currentComment.value = "";
    currentDefectKey.value = "";
    currentImages.value = [];
  }

  isDragging.value = false;
}

// Save comment without changing status
async function saveComment() {
  if (!selectedTestCase.value) return;

  const existingResult = testResultsStore.getResultByTestCaseId(
    selectedTestCase.value.id,
  );
  const currentStatus = existingResult?.status || "passed";
  const stepDraft = testResultsStore.getStepResultsDraftForCase(
    selectedTestCase.value.id,
  );

  isSaving.value = true;
  try {
    const saved = await testResultsStore.submitResult(testRunId, {
      test_case_id: selectedTestCase.value.id,
      status: currentStatus,
      comment: currentComment.value || undefined,
      step_results: stepDraft.length > 0 ? stepDraft : undefined,
      defects: currentDefectKey.value
        ? [
            {
              tracker: "jira",
              key: currentDefectKey.value,
            },
          ]
        : existingResult?.defects || undefined,
    });

    const failures =
      saved.id != null ? await syncCurrentImages(saved.id) : [];
    if (failures && failures.length > 0) {
      toast.add({
        severity: "warn",
        summary: "Saved with errors",
        detail: `${failures.length} attachment operation(s) failed`,
        life: 4000,
      });
    } else {
      toast.add({
        severity: "success",
        summary: "Saved",
        detail: "Comment and attachments saved",
        life: 2000,
      });
    }

    await testResultsStore.fetchResults(testRunId);
    if (selectedTestCase.value) selectTestCase(selectedTestCase.value);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to save",
      life: 5000,
    });
  } finally {
    isSaving.value = false;
  }
}

// Submit result for current test case
async function submitResult(status: ResultStatus) {
  if (!selectedTestCase.value) return;

  isSubmitting.value = true;
  const wasPlanned =
    testRunsStore.currentTestRun?.status === "planned";
  try {
    const stepDraft = testResultsStore.getStepResultsDraftForCase(
      selectedTestCase.value.id,
    );
    const saved = await testResultsStore.submitResult(testRunId, {
      test_case_id: selectedTestCase.value.id,
      status,
      comment: currentComment.value || undefined,
      step_results: stepDraft.length > 0 ? stepDraft : undefined,
      defects: currentDefectKey.value
        ? [
            {
              tracker: "jira",
              key: currentDefectKey.value,
            },
          ]
        : undefined,
    });

    if (wasPlanned) {
      // First result on a planned run — flip to active locally; the next
      // run fetch will confirm (or correct) via the API adapter.
      testRunsStore.setRunStatusOptimistic(testRunId, "active");
    }

    if (saved.id != null) await syncCurrentImages(saved.id);
    await testResultsStore.fetchResults(testRunId);
    await testRunsStore.fetchProgress(testRunId);
    await testRunsStore.fetchTestRun(testRunId);

    toast.add({
      severity: "success",
      summary: "Result Submitted",
      detail: `Test case marked as ${status}`,
      life: 2000,
    });

    // Auto-advance to the next `no_run` case in DFS render order — matches
    // how the suite-tree visually presents cases so the next step always
    // lands on the visible successor.
    const currentId = selectedTestCase.value?.id ?? null;
    const nextUntested =
      suiteTreeRef.value?.findNextUntestedAfter(currentId) ?? null;
    if (nextUntested) {
      selectTestCase(nextUntested);
    } else {
      selectedTestCase.value = null;
    }
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to submit result",
      life: 5000,
    });
  } finally {
    isSubmitting.value = false;
  }
}

// Image handling functions
function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return `"${file.name}" is not an image file`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the maximum file size of ${formatFileSize(MAX_FILE_SIZE)}`;
  }
  return null;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function processFiles(files: File[]) {
  const availableSlots = MAX_IMAGES - currentImages.value.length;

  for (let i = 0; i < Math.min(files.length, availableSlots); i++) {
    const file = files[i];
    const error = validateFile(file);

    if (error) {
      toast.add({
        severity: "error",
        summary: "Upload Error",
        detail: error,
        life: 5000,
      });
      continue;
    }

    try {
      const preview = await readFileAsDataURL(file);
      currentImages.value.push({
        id: generateId(),
        file,
        preview,
        name: file.name,
        size: file.size,
      });
    } catch {
      toast.add({
        severity: "error",
        summary: "Upload Error",
        detail: `Failed to read file "${file.name}"`,
        life: 5000,
      });
    }
  }

  if (files.length > availableSlots) {
    toast.add({
      severity: "warn",
      summary: "Limit Reached",
      detail: `Only ${availableSlots} more image(s) can be added (max ${MAX_IMAGES})`,
      life: 5000,
    });
  }
}

function removeImage(id: string) {
  currentImages.value = currentImages.value.filter((img) => img.id !== id);
}

// Global paste handler
function handleGlobalPaste(e: ClipboardEvent) {
  if (!selectedTestCase.value || !canAddMoreImages.value) return;

  const items = e.clipboardData?.items;
  if (!items) return;

  const imageFiles: File[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        imageFiles.push(file);
      }
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    processFiles(imageFiles);
  }
}

// Drag and drop handlers
function handleDragOver(e: DragEvent) {
  e.preventDefault();
  if (selectedTestCase.value && canAddMoreImages.value) {
    isDragging.value = true;
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  const rect = commentAreaRef.value?.getBoundingClientRect();
  if (rect) {
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      isDragging.value = false;
    }
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  if (!selectedTestCase.value || !canAddMoreImages.value) return;

  const files = e.dataTransfer?.files;
  if (files) {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (imageFiles.length > 0) {
      processFiles(imageFiles);
    }
  }
}

// Complete the test run
async function completeTestRun() {
  try {
    await testRunsStore.closeTestRun(testRunId);
    toast.add({
      severity: "success",
      summary: "Test Run Completed",
      detail: "The test run has been marked as completed",
      life: 3000,
    });
    router.push(`/test-runs/${testRunId}`);
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to complete test run",
      life: 5000,
    });
  }
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  if (!selectedTestCase.value) return;

  // Only handle if not in an input field
  if (["INPUT", "TEXTAREA"].includes((event.target as HTMLElement).tagName))
    return;

  switch (event.key) {
    case "1":
      submitResult("passed");
      break;
    case "2":
      submitResult("failed");
      break;
    case "3":
      submitResult("blocked");
      break;
    case "4":
      submitResult("no_run");
      break;
    case "ArrowDown":
    case "j":
      // Move to next test case
      const currentIndex = filteredTestCases.value.findIndex(
        (tc) => tc.id === selectedTestCase.value?.id,
      );
      if (currentIndex < filteredTestCases.value.length - 1) {
        selectTestCase(filteredTestCases.value[currentIndex + 1]);
      }
      break;
    case "ArrowUp":
    case "k":
      // Move to previous test case
      const currIdx = filteredTestCases.value.findIndex(
        (tc) => tc.id === selectedTestCase.value?.id,
      );
      if (currIdx > 0) {
        selectTestCase(filteredTestCases.value[currIdx - 1]);
      }
      break;
  }
}

onMounted(async () => {
  await testRunsStore.fetchTestRun(testRunId);

  // Get project ID from test run and fetch related data
  const testRun = testRunsStore.currentTestRun;
  if (testRun) {
    await Promise.all([
      testSuitesStore.fetchTestSuites(testRun.project_id),
      testResultsStore.fetchRunCasesWithResults(testRunId),
      testRunsStore.fetchProgress(testRunId),
    ]);

    // Auto-select first untested case
    const firstUntested = testCases.value.find((tc) => {
      const result = testResultsStore.getResultByTestCaseId(tc.id);
      return !result;
    });
    if (firstUntested) {
      selectTestCase(firstUntested);
    }
  }

  // Add keyboard listener
  window.addEventListener("keydown", handleKeydown);
  // Add global paste listener
  document.addEventListener("paste", handleGlobalPaste);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("paste", handleGlobalPaste);
});

// Watch for test run changes
watch(
  () => testRunsStore.currentTestRun,
  (newRun) => {
    if (newRun?.status === "completed") {
      router.push(`/test-runs/${testRunId}`);
    }
  },
);
</script>

<template>
  <DefaultLayout>
    <div class="test-run-execution-view">
      <!-- Header with progress -->
      <div class="execution-header">
        <div class="header-left">
          <Button
            icon="pi pi-arrow-left"
            text
            @click="router.push(`/test-runs/${testRunId}`)"
            label="Exit"
          />
          <div class="run-info" v-if="testRunsStore.currentTestRun">
            <h1>{{ testRunsStore.currentTestRun.name }}</h1>
            <div class="run-meta">
              <Tag
                :value="
                  RUN_STATUS_LABELS[testRunsStore.currentTestRun.status] ||
                  testRunsStore.currentTestRun.status
                "
                :severity="
                  testRunsStore.currentTestRun.status === 'active'
                    ? 'warning'
                    : testRunsStore.currentTestRun.status === 'completed'
                      ? 'success'
                      : 'secondary'
                "
              />
              <span v-if="testRunsStore.currentTestRun.config?.environment">
                {{ testRunsStore.currentTestRun.config.environment }}
              </span>
            </div>
          </div>
        </div>
        <div class="header-right">
          <Button
            label="Complete Run"
            icon="pi pi-check"
            severity="success"
            @click="completeTestRun"
          />
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-stats">
          <span class="stat passed">
            <i class="pi pi-check-circle"></i>
            {{ runProgress.passed }} Passed
          </span>
          <span class="stat failed">
            <i class="pi pi-times-circle"></i>
            {{ runProgress.failed }} Failed
          </span>
          <span class="stat blocked">
            <i class="pi pi-ban"></i>
            {{ runProgress.blocked }} Blocked
          </span>
          <span class="stat no-run">
            <i class="pi pi-minus-circle"></i>
            {{ runProgress.no_run }} No Run
          </span>
        </div>
        <TestRunProgressBar :progress="runProgress" />
        <div class="progress-label">
          {{ runProgress.passed }}/{{ runProgress.total }} passed ({{
            formatPassRate(runProgress.pass_rate, { decimals: 1 })
          }}
          pass rate)
        </div>
      </div>

      <!-- Main execution layout -->
      <div class="execution-layout">
        <!-- Left: Test case list -->
        <Card class="test-list-panel">
          <template #title>
            <div class="panel-header">
              <span>Test Cases</span>
              <select v-model="statusFilter" class="status-filter">
                <option value="all">All</option>
                <option
                  v-for="status in RESULT_STATUSES"
                  :key="status"
                  :value="status"
                >
                  {{ RESULT_STATUS_LABELS[status] }}
                </option>
              </select>
            </div>
          </template>
          <template #content>
            <div class="test-case-list">
              <SuiteTreeResults
                ref="suiteTreeRef"
                :cases="filteredTestCases"
                :results="testResultsStore.results"
                :suite-tree="testSuitesStore.suiteTree"
                mode="execute"
                :selected-case-id="selectedTestCase?.id ?? null"
                :run-id="testRunId"
                @select="handleCaseTreeSelect"
              />
              <div v-if="filteredTestCases.length === 0" class="empty-list">
                <p>No test cases match filter</p>
              </div>
            </div>
          </template>
        </Card>

        <!-- Right: Execution panel -->
        <div class="execution-panel">
          <template v-if="selectedTestCase">
            <!-- Test case details -->
            <Card class="test-details-card">
              <template #title>
                <div class="test-details-header">
                  <div>
                    <h2>{{ selectedTestCase.title }}</h2>
                    <div class="test-meta">
                      <Tag
                        :value="
                          PRIORITY_LABELS[selectedTestCase.priority] ||
                          selectedTestCase.priority
                        "
                        :severity="
                          getPrioritySeverity(selectedTestCase.priority)
                        "
                      />
                      <span>{{ selectedTestCase.type }}</span>
                      <span>{{ getSuiteName(selectedTestCase.suite_id) }}</span>
                    </div>
                  </div>
                </div>
              </template>
              <template #content>
                <div v-if="selectedTestCase.description" class="section">
                  <h4>Description</h4>
                  <div
                    v-html="selectedTestCase.description"
                    class="description-content"
                  ></div>
                </div>

                <div v-if="selectedTestCase.preconditions" class="section">
                  <h4>Preconditions</h4>
                  <div
                    v-html="selectedTestCase.preconditions"
                    class="preconditions-content"
                  ></div>
                </div>

                <div class="section">
                  <h4>Test Steps</h4>
                  <div class="steps-list">
                    <div
                      v-for="(step, index) in selectedTestCase.steps"
                      :key="index"
                      class="step-item"
                    >
                      <div class="step-number">{{ index + 1 }}</div>
                      <div class="step-content">
                        <div class="step-action">
                          <strong>Action:</strong>
                          <div class="tiptap-content" v-html="step.step"></div>
                        </div>
                        <div class="step-expected">
                          <strong>Expected:</strong>
                          <div
                            class="tiptap-content"
                            v-html="step.expected"
                          ></div>
                        </div>
                      </div>
                      <div class="step-picker">
                        <StepStatusPicker
                          :status="getStepDraftStatus(index)"
                          :comment="getStepDraftComment(index)"
                          @update:status="handleStepStatusChange(index, $event)"
                          @update:comment="
                            handleStepCommentChange(index, $event)
                          "
                        />
                      </div>
                    </div>
                    <div
                      v-if="selectedTestCase.steps.length === 0"
                      class="no-steps"
                    >
                      No steps defined for this test case.
                    </div>
                  </div>
                </div>
              </template>
            </Card>

            <!-- Result submission -->
            <Card class="result-card">
              <template #title>Submit Result</template>
              <template #content>
                <div class="result-form">
                  <div class="field">
                    <label>Comment & Attachments</label>
                    <div
                      ref="commentAreaRef"
                      class="comment-drop-area"
                      :class="{ dragging: isDragging }"
                      @dragover="handleDragOver"
                      @dragleave="handleDragLeave"
                      @drop="handleDrop"
                    >
                      <!-- Drag overlay -->
                      <div v-if="isDragging" class="drag-overlay">
                        <i class="pi pi-image"></i>
                        <span>Drop image here</span>
                      </div>

                      <Textarea
                        v-model="currentComment"
                        rows="2"
                        placeholder="Add notes about the execution... (Ctrl+V to paste images)"
                        class="w-full comment-textarea"
                      />

                      <!-- Image Previews -->
                      <div
                        v-if="currentImages.length > 0"
                        class="image-previews"
                      >
                        <div
                          v-for="image in currentImages"
                          :key="image.id"
                          class="image-preview"
                        >
                          <img :src="image.preview" :alt="image.name" />
                          <div class="image-info">
                            <span class="image-name" :title="image.name">{{
                              image.name
                            }}</span>
                            <span class="image-size">{{
                              formatFileSize(image.size)
                            }}</span>
                          </div>
                          <Button
                            icon="pi pi-times"
                            rounded
                            text
                            severity="danger"
                            size="small"
                            class="remove-btn"
                            @click="removeImage(image.id)"
                            aria-label="Remove image"
                          />
                        </div>
                      </div>

                      <!-- Hint -->
                      <div class="drop-hint" v-if="canAddMoreImages">
                        <i class="pi pi-info-circle"></i>
                        <span
                          >Paste (Ctrl+V) or drag & drop images ({{
                            currentImages.length
                          }}/{{ MAX_IMAGES }})</span
                        >
                      </div>
                    </div>
                  </div>

                  <div class="field">
                    <label>Defect Key (optional)</label>
                    <InputText
                      v-model="currentDefectKey"
                      placeholder="e.g., PROJ-123"
                      class="w-full"
                    />
                  </div>

                  <!-- Save button for comment/attachments -->
                  <div class="save-section">
                    <Button
                      label="Save"
                      icon="pi pi-check"
                      outlined
                      :loading="isSaving"
                      :disabled="!commentPanelIsDirty || isSaving"
                      @click="saveComment"
                    />
                    <span
                      class="save-hint"
                      v-if="currentImages.some((img) => !img.isExisting)"
                    >
                      <i class="pi pi-info-circle"></i>
                      Unsaved images
                    </span>
                  </div>

                  <Divider />

                  <div v-if="suggestedStatus" class="suggest-status">
                    <Button
                      :label="`Suggest: ${RESULT_STATUS_LABELS[suggestedStatus]}`"
                      icon="pi pi-bolt"
                      text
                      size="small"
                      @click="submitResult(suggestedStatus!)"
                    />
                  </div>

                  <div class="status-buttons">
                    <Button
                      data-testid="execution-status-passed"
                      label="Passed"
                      icon="pi pi-check-circle"
                      severity="success"
                      :loading="isSubmitting"
                      @click="submitResult('passed')"
                    />
                    <Button
                      label="Failed"
                      icon="pi pi-times-circle"
                      severity="danger"
                      :loading="isSubmitting"
                      @click="submitResult('failed')"
                    />
                    <Button
                      label="Blocked"
                      icon="pi pi-ban"
                      severity="secondary"
                      class="verdict-btn--blocked"
                      :loading="isSubmitting"
                      @click="submitResult('blocked')"
                    />
                    <Button
                      label="No Run"
                      icon="pi pi-minus-circle"
                      severity="secondary"
                      :loading="isSubmitting"
                      @click="submitResult('no_run')"
                    />
                  </div>

                  <div class="shortcuts-hint">
                    <small
                      >Keyboard shortcuts: 1=Pass, 2=Fail, 3=Block, 4=No Run,
                      j/k=Navigate</small
                    >
                  </div>
                </div>
              </template>
            </Card>
          </template>

          <template v-else>
            <Card class="no-selection-card">
              <template #content>
                <div class="no-selection">
                  <i class="pi pi-file-edit"></i>
                  <h3>Select a test case to begin</h3>
                  <p>
                    Choose a test case from the list on the left to start
                    execution
                  </p>
                </div>
              </template>
            </Card>
          </template>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.execution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.run-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.run-info h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.run-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.progress-section {
  background: var(--surface-card);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.progress-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.stat.passed {
  color: #22c55e;
}
.stat.failed {
  color: #ef4444;
}
.stat.blocked {
  color: #4b5563;
}
.stat.no-run {
  color: #9ca3af;
}

.verdict-btn--blocked {
  --p-button-secondary-background: #1f2937;
  --p-button-secondary-border-color: #1f2937;
  --p-button-secondary-color: #fff;
  --p-button-secondary-hover-background: #111827;
  --p-button-secondary-hover-border-color: #111827;
  --p-button-secondary-hover-color: #fff;
  --p-button-secondary-active-background: #0b1220;
  --p-button-secondary-active-border-color: #0b1220;
  --p-button-secondary-active-color: #fff;
  background: #1f2937 !important;
  border-color: #1f2937 !important;
  color: #fff !important;
}

.verdict-btn--blocked:not(:disabled):hover {
  background: #111827 !important;
  border-color: #111827 !important;
  color: #fff !important;
}

.verdict-btn--blocked:not(:disabled):active {
  background: #0b1220 !important;
  border-color: #0b1220 !important;
  color: #fff !important;
}

/* Dark mode: the near-black blocked verdict button (#1f2937) blends into the
 * dark page surface (#0f172a). Lift the slate one notch and add a contrasting
 * border so the button outline reads, matching how the Blocked status badge
 * (StatusBadge#status-badge--result-blocked) gets an inset highlight in dark
 * mode (plan-087). Pre-existing low-contrast issue surfaced when verifying
 * /test-runs/:id/execute dark rendering. */
[data-theme="dark"] .verdict-btn--blocked,
[data-theme="dark"] .verdict-btn--blocked:not(:disabled):active {
  background: #475569 !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: #fff !important;
}

[data-theme="dark"] .verdict-btn--blocked:not(:disabled):hover {
  background: #334155 !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: #fff !important;
}

/* Dark mode: .stat.blocked (#4b5563) on the dark page surface gives ~3.3:1
 * contrast — fails WCAG AA for normal text. Lift to a lighter slate that
 * stays semantically "muted" but actually reads. */
[data-theme="dark"] .stat.blocked {
  color: #94a3b8;
}

.progress-bar {
  height: 8px;
}

.progress-label {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-color-secondary);
  text-align: center;
}

.execution-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 16px;
  height: calc(100vh - 280px);
}

.test-list-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-filter {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--surface-border);
  background: var(--surface-ground);
  font-size: 12px;
}

.test-case-list {
  overflow-y: auto;
  max-height: calc(100vh - 400px);
}

.test-case-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--surface-border);
  transition: background 0.2s;
}

.test-case-item:hover {
  background: var(--surface-hover);
}

.test-case-item.selected {
  background: var(--primary-50);
  border-left: 3px solid var(--primary-color);
}

.status-indicator {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-indicator i {
  color: white;
  font-size: 12px;
}

.test-case-info {
  flex: 1;
  min-width: 0;
}

.test-case-title {
  display: block;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.test-case-suite {
  display: block;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.empty-list {
  padding: 24px;
  text-align: center;
  color: var(--text-color-secondary);
}

.execution-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.test-details-card {
  flex-shrink: 0;
}

.test-details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.test-details-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.test-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.section {
  margin-bottom: 20px;
}

.section h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-color);
}

.description-content,
.preconditions-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-color-secondary);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--surface-ground);
  border-radius: 8px;
  align-items: flex-start;
}

.step-picker {
  flex-shrink: 0;
  margin-left: auto;
}

.suggest-status {
  margin-bottom: 8px;
}

.step-number {
  width: 28px;
  height: 28px;
  background: var(--primary-color);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-action,
.step-expected {
  font-size: 14px;
  margin-bottom: 4px;
}

.step-action strong,
.step-expected strong {
  color: var(--text-color-secondary);
}

.no-steps {
  padding: 16px;
  text-align: center;
  color: var(--text-color-secondary);
  font-style: italic;
}

.result-card {
  flex-shrink: 0;
}

.result-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-weight: 500;
  font-size: 14px;
}

.w-full {
  width: 100%;
}

/* Comment Drop Area */
.comment-drop-area {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 2px dashed var(--surface-border);
  border-radius: 8px;
  background-color: var(--surface-ground);
  transition: all 0.2s ease;
}

.comment-drop-area.dragging {
  border-color: var(--primary-color);
  background-color: var(--primary-50);
}

.comment-drop-area .comment-textarea {
  border: none;
  background: transparent;
}

.drag-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: rgba(102, 126, 234, 0.9);
  color: white;
  border-radius: 6px;
  z-index: 10;
  pointer-events: none;
}

.drag-overlay i {
  font-size: 2rem;
}

.drag-overlay span {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Image Previews */
.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-preview {
  position: relative;
  width: 120px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  background-color: var(--surface-card);
}

.image-preview img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
}

.image-info {
  padding: 4px 6px;
  background-color: var(--surface-ground);
}

.image-name {
  display: block;
  font-size: 0.65rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-size {
  display: block;
  font-size: 0.6rem;
  color: var(--text-color-secondary);
}

.image-preview .remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px !important;
  height: 22px !important;
  background-color: var(--surface-card) !important;
}

.drop-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

.drop-hint i {
  font-size: 0.75rem;
  color: var(--primary-color);
}

/* Save Section */
.save-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--orange-500);
}

.save-hint i {
  font-size: 0.75rem;
}

.status-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.shortcuts-hint {
  text-align: center;
  color: var(--text-color-secondary);
}

.no-selection-card {
  flex: 1;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--text-color-secondary);
}

.no-selection i {
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-selection h3 {
  margin: 0 0 8px 0;
  color: var(--text-color);
}

@media (max-width: 1024px) {
  .execution-layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .test-case-list {
    max-height: 300px;
  }
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .execution-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .header-left {
    flex-wrap: wrap;
  }

  .run-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .run-info h1 {
    font-size: 16px;
    word-break: break-word;
  }

  .run-meta {
    gap: 8px;
    font-size: 12px;
  }

  .header-right {
    width: 100%;
  }

  .header-right :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .progress-section {
    padding: 12px;
  }

  .progress-stats {
    gap: 12px;
    justify-content: space-between;
  }

  .stat {
    font-size: 11px;
    gap: 4px;
  }

  .stat i {
    font-size: 12px;
  }

  .progress-label {
    font-size: 12px;
  }

  .test-case-list {
    max-height: 250px;
  }

  .test-case-item {
    padding: 10px;
    gap: 10px;
  }

  .status-indicator {
    width: 24px;
    height: 24px;
  }

  .status-indicator i {
    font-size: 10px;
  }

  .test-case-title {
    font-size: 13px;
  }

  .test-case-suite {
    font-size: 11px;
  }

  .test-details-header {
    flex-direction: column;
    gap: 12px;
  }

  .test-details-header h2 {
    font-size: 16px;
  }

  .test-meta {
    flex-wrap: wrap;
    gap: 8px;
  }

  .section h4 {
    font-size: 13px;
  }

  .step-item {
    padding: 10px;
    gap: 10px;
  }

  .step-number {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .step-action,
  .step-expected {
    font-size: 13px;
  }

  .status-buttons {
    gap: 8px;
  }

  .status-buttons :deep(.p-button) {
    flex: 1;
    min-width: 0;
    padding: 0.5rem;
    font-size: 0.8rem;
  }

  .status-buttons :deep(.p-button-label) {
    display: none;
  }

  .shortcuts-hint {
    display: none;
  }

  .image-preview {
    width: 100px;
  }

  .image-preview img {
    height: 60px;
  }
}

@media (max-width: 480px) {
  .run-info h1 {
    font-size: 14px;
  }

  .progress-stats {
    flex-wrap: wrap;
    gap: 8px;
  }

  .stat {
    font-size: 10px;
    white-space: nowrap;
  }

  .test-case-list {
    max-height: 200px;
  }

  .test-details-header h2 {
    font-size: 14px;
  }

  .status-buttons {
    flex-wrap: wrap;
  }

  .status-buttons :deep(.p-button) {
    flex: 1 1 45%;
  }

  .save-section {
    flex-direction: column;
    align-items: stretch;
  }

  .save-section :deep(.p-button) {
    width: 100%;
  }
}
</style>
