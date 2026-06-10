import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  Attachment,
  BulkUploadResponse,
  TestResult,
  TestResultCreate,
  TestResultHistory,
  TestResultUpdate,
  StepResult,
  ResultStatus,
  Defect,
} from "@/types/testResult";
import type { TestRunProgress, TestCaseWithResult } from "@/types/testRun";
import * as testResultsApi from "@/api/testResults";
import * as testRunsApi from "@/api/testRuns";
import { useTestRunsStore } from "./testRuns";

export function synthesiseNoRunResult(
  runId: number,
  testCase: TestCaseWithResult,
): TestResult {
  return {
    id: null,
    test_run_id: runId,
    test_case_id: testCase.id,
    status: "no_run",
    comment: null,
    message: null,
    stack_trace: null,
    execution_time: null,
    defects: [],
    tested_by: null,
    tested_at: "",
    step_results: null,
    attachments: [],
    test_case: {
      id: testCase.id,
      title: testCase.title,
      type: testCase.type,
      priority: testCase.priority,
    },
  };
}

export const useTestResultsStore = defineStore("testResults", () => {
  const results = ref<TestResult[]>([]);
  const runCases = ref<TestCaseWithResult[]>([]);
  const currentResult = ref<TestResult | null>(null);
  const currentRunId = ref<number | null>(null);
  const totalCasesInRun = ref(0);
  const history = ref<Record<number, TestResultHistory[]>>({});
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const stepResultsDraft = ref<Record<number, StepResult[]>>({});

  // Sync progress to test run store
  function syncProgressToTestRun(runId: number) {
    const testRunsStore = useTestRunsStore();
    const total = totalCasesInRun.value || results.value.length;
    const passed = results.value.filter((r) => r.status === "passed").length;
    const failed = results.value.filter((r) => r.status === "failed").length;
    const blocked = results.value.filter((r) => r.status === "blocked").length;
    const explicitNoRun = results.value.filter(
      (r) => r.status === "no_run",
    ).length;
    const missingResult = Math.max(0, total - results.value.length);

    const progressData: TestRunProgress = {
      total,
      passed,
      failed,
      blocked,
      no_run: explicitNoRun + missingResult,
      // 0..1 ratio (api plan 035) — matches the wire shape of TestRunProgress.
      // Was previously a 0..100 percent here by mistake; fixed under plan-083.
      pass_rate: total > 0 ? passed / total : null,
    };

    testRunsStore.updateTestRunProgress(runId, progressData);
  }

  function getResultByTestCaseId(testCaseId: number): TestResult | undefined {
    return results.value.find((r) => r.test_case_id === testCaseId);
  }

  async function fetchRunCasesWithResults(runId: number) {
    loading.value = true;
    error.value = null;
    currentRunId.value = runId;

    try {
      const data = await testRunsApi.getTestRunCases(runId);
      totalCasesInRun.value = data.cases.length;
      runCases.value = data.cases;
      results.value = data.cases.map((tc) =>
        tc.result ? tc.result : synthesiseNoRunResult(runId, tc),
      );
    } catch (e) {
      error.value = "Failed to load test run cases";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchResults(runId: number) {
    loading.value = true;
    error.value = null;
    currentRunId.value = runId;

    try {
      results.value = await testResultsApi.getTestResults(runId);
      if (results.value.length > 0) {
        syncProgressToTestRun(runId);
      }
    } catch (e) {
      error.value = "Failed to load test results";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function setTotalCases(count: number) {
    totalCasesInRun.value = count;
  }

  async function submitResult(
    runId: number,
    data: TestResultCreate,
  ): Promise<TestResult> {
    submitting.value = true;
    error.value = null;
    try {
      const result = await testResultsApi.submitTestResult(runId, data);

      const index = results.value.findIndex(
        (r) => r.test_case_id === data.test_case_id,
      );
      if (index !== -1) {
        results.value[index] = result;
      } else {
        results.value.push(result);
      }

      currentResult.value = result;
      syncProgressToTestRun(runId);

      return result;
    } finally {
      submitting.value = false;
    }
  }

  async function updateResult(
    id: number,
    data: TestResultUpdate,
  ): Promise<TestResult> {
    submitting.value = true;
    error.value = null;
    try {
      const updated = await testResultsApi.updateTestResult(id, data);

      const index = results.value.findIndex((r) => r.id === id);
      if (index !== -1) {
        results.value[index] = updated;
      }
      if (currentResult.value?.id === id) {
        currentResult.value = updated;
      }
      if (currentRunId.value) {
        syncProgressToTestRun(currentRunId.value);
      }

      return updated;
    } finally {
      submitting.value = false;
    }
  }

  async function addDefectToResult(resultId: number, defect: Defect) {
    const target = results.value.find((r) => r.id === resultId);
    const previous = target?.defects ? [...target.defects] : [];
    const alreadyLinked = previous.some(
      (d) => d.tracker === defect.tracker && d.key === defect.key,
    );
    if (alreadyLinked) return target;

    const nextList = [...previous, defect];
    if (target) target.defects = nextList;
    if (currentResult.value?.id === resultId) {
      currentResult.value = { ...currentResult.value, defects: nextList };
    }

    try {
      const updated = await updateResult(resultId, { defects: nextList });
      if (currentRunId.value != null) {
        await fetchRunCasesWithResults(currentRunId.value);
      }
      return updated;
    } catch (e) {
      if (target) target.defects = previous;
      if (currentResult.value?.id === resultId) {
        currentResult.value = { ...currentResult.value, defects: previous };
      }
      throw e;
    }
  }

  async function removeDefectFromResult(resultId: number, key: string) {
    const target = results.value.find((r) => r.id === resultId);
    const previous = target?.defects ? [...target.defects] : [];
    const nextList = previous.filter((d) => d.key !== key);
    if (nextList.length === previous.length) return target;

    if (target) target.defects = nextList;
    if (currentResult.value?.id === resultId) {
      currentResult.value = { ...currentResult.value, defects: nextList };
    }

    try {
      const updated = await updateResult(resultId, { defects: nextList });
      if (currentRunId.value != null) {
        await fetchRunCasesWithResults(currentRunId.value);
      }
      return updated;
    } catch (e) {
      if (target) target.defects = previous;
      if (currentResult.value?.id === resultId) {
        currentResult.value = { ...currentResult.value, defects: previous };
      }
      throw e;
    }
  }

  function mergeAttachment(resultId: number, attachment: Attachment) {
    const row = results.value.find((r) => r.id === resultId);
    if (!row) return;
    const existing = row.attachments ?? [];
    const idx = existing.findIndex((a) => a.id === attachment.id);
    if (idx === -1) {
      row.attachments = [...existing, attachment];
    } else {
      const copy = [...existing];
      copy[idx] = attachment;
      row.attachments = copy;
    }
    if (currentResult.value?.id === resultId) {
      currentResult.value = { ...row };
    }
  }

  function removeAttachmentLocal(resultId: number, attachmentId: number) {
    const row = results.value.find((r) => r.id === resultId);
    if (!row?.attachments) return;
    row.attachments = row.attachments.filter((a) => a.id !== attachmentId);
    if (currentResult.value?.id === resultId) {
      currentResult.value = { ...row };
    }
  }

  async function uploadAttachment(
    resultId: number,
    file: File,
  ): Promise<Attachment> {
    const attachment = await testResultsApi.uploadAttachment(resultId, file);
    mergeAttachment(resultId, attachment);
    return attachment;
  }

  async function uploadAttachmentsBulk(
    resultId: number,
    files: File[],
  ): Promise<BulkUploadResponse> {
    const response = await testResultsApi.uploadAttachmentsBulk(resultId, files);
    for (const att of response.uploaded) {
      mergeAttachment(resultId, att);
    }
    return response;
  }

  async function deleteAttachment(
    resultId: number,
    attachmentId: number,
  ): Promise<void> {
    await testResultsApi.deleteAttachment(resultId, attachmentId);
    removeAttachmentLocal(resultId, attachmentId);
  }

  function setCurrentResult(result: TestResult | null) {
    currentResult.value = result;
  }

  async function fetchHistory(resultId: number): Promise<void> {
    const entries = await testResultsApi.getTestResultHistory(resultId);
    history.value[resultId] = entries;
  }

  function setStepStatus(caseId: number, index: number, status: ResultStatus) {
    const draft = [...(stepResultsDraft.value[caseId] || [])];
    const existing = draft.findIndex((r) => r.index === index);
    if (existing !== -1) {
      draft[existing] = { ...draft[existing], status };
    } else {
      draft.push({ index, status });
    }
    stepResultsDraft.value = { ...stepResultsDraft.value, [caseId]: draft };
  }

  function setStepComment(caseId: number, index: number, comment: string) {
    const draft = [...(stepResultsDraft.value[caseId] || [])];
    const existing = draft.findIndex((r) => r.index === index);
    if (existing !== -1) {
      draft[existing] = { ...draft[existing], comment: comment || null };
    }
    stepResultsDraft.value = { ...stepResultsDraft.value, [caseId]: draft };
  }

  function clearStep(caseId: number, index: number) {
    const draft = (stepResultsDraft.value[caseId] || []).filter(
      (r) => r.index !== index,
    );
    stepResultsDraft.value = { ...stepResultsDraft.value, [caseId]: draft };
  }

  function hydrateFromResult(caseId: number, result: TestResult) {
    stepResultsDraft.value = {
      ...stepResultsDraft.value,
      [caseId]: result.step_results ? [...result.step_results] : [],
    };
  }

  function getStepResultsDraftForCase(caseId: number): StepResult[] {
    return stepResultsDraft.value[caseId] || [];
  }

  function clearResults() {
    results.value = [];
    runCases.value = [];
    currentResult.value = null;
    totalCasesInRun.value = 0;
    stepResultsDraft.value = {};
  }

  return {
    results,
    runCases,
    currentResult,
    totalCasesInRun,
    history,
    loading,
    submitting,
    error,
    stepResultsDraft,
    getResultByTestCaseId,
    getStepResultsDraftForCase,
    fetchResults,
    fetchRunCasesWithResults,
    fetchHistory,
    setTotalCases,
    submitResult,
    updateResult,
    addDefectToResult,
    removeDefectFromResult,
    uploadAttachment,
    uploadAttachmentsBulk,
    deleteAttachment,
    setCurrentResult,
    setStepStatus,
    setStepComment,
    clearStep,
    hydrateFromResult,
    clearResults,
  };
});
