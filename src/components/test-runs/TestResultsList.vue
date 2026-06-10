<script setup lang="ts">
import { ref, computed } from "vue";
import type { TestResult, ResultStatus } from "@/types/testResult";
import { RESULT_STATUSES, RESULT_STATUS_COLORS } from "@/types/testResult";
import type {
  TestCaseWithResult,
  TestRun,
  TestRunProgress,
} from "@/types/testRun";
import { RUN_STATUS_LABELS } from "@/types/testRun";
import type { TestSuiteTree } from "@/types/testSuite";
import { statusLabel } from "@/utils/statusLabel";
import { formatPassRate } from "@/utils/passRate";
import TestRunProgressBar from "./TestRunProgressBar.vue";
import SuiteTreeResults from "./SuiteTreeResults.vue";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Button from "primevue/button";
import Tag from "primevue/tag";

const props = defineProps<{
  results: TestResult[];
  selectedResult?: TestResult | null;
  loading?: boolean;
  runProgress?: TestRunProgress;
  testRun?: TestRun | null;
  runCases?: TestCaseWithResult[];
  suiteTree?: TestSuiteTree[];
  canEditCases?: boolean;
}>();

function getRunStatusSeverity(
  status: string | undefined,
): "success" | "info" | "warning" | "danger" | "secondary" {
  const map: Record<
    string,
    "success" | "info" | "warning" | "danger" | "secondary"
  > = {
    planned: "info",
    active: "warning",
    completed: "success",
    aborted: "danger",
  };
  return status ? map[status] ?? "secondary" : "secondary";
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const emit = defineEmits<{
  (e: "select", result: TestResult): void;
  (e: "edit-cases"): void;
}>();

const searchQuery = ref("");
const statusFilterValue = ref<ResultStatus | "all" | null>("all");

// Computed to handle clear - resets to 'all' when cleared
const statusFilter = computed({
  get: () => statusFilterValue.value || "all",
  set: (val) => {
    statusFilterValue.value = val || "all";
  },
});

const statusOptions = computed(() => {
  return [
    { label: "All Statuses", value: "all" },
    ...RESULT_STATUSES.map((s) => ({ label: statusLabel(s), value: s })),
  ];
});

// Total defects across all results
const totalDefects = computed(() =>
  props.results.reduce((sum, r) => sum + (r.defects ?? []).length, 0),
);

// Progress stats
const progress = computed(() => {
  const total = props.results.length;
  if (total === 0)
    return {
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      no_run: 0,
    };

  const passed = props.results.filter((r) => r.status === "passed").length;
  const failed = props.results.filter((r) => r.status === "failed").length;
  const blocked = props.results.filter((r) => r.status === "blocked").length;
  const no_run = props.results.filter((r) => r.status === "no_run").length;
  const executed = passed + failed + blocked + no_run;

  return {
    total,
    passed,
    failed,
    blocked,
    no_run,
    executed,
    completionRate: total > 0 ? Math.round((executed / total) * 100) : 0,
  };
});

// Use the authoritative TestRunProgress when the parent supplies it,
// otherwise shape one from the locally-reduced counts so the segmented
// progress bar can render in isolation.
const segmentedProgress = computed<TestRunProgress>(() => {
  if (props.runProgress) return props.runProgress;
  const p = progress.value;
  return {
    total: p.total,
    passed: p.passed,
    failed: p.failed,
    blocked: p.blocked,
    no_run: p.no_run,
    pass_rate:
      p.executed && p.executed > 0 ? (p.passed / p.executed) * 100 : null,
  };
});

// Filtered cases for the suite-tree view (filters compose with the
// status-filter + search query). A case is "passing the status filter" when
// its matching result has that status, or — for `no_run` — when no result
// exists yet.
const filteredCases = computed(() => {
  const cases = props.runCases ?? [];
  const q = searchQuery.value.trim().toLowerCase();
  const activeStatus = statusFilter.value;
  return cases.filter((tc) => {
    if (activeStatus !== "all") {
      const result = props.results.find((r) => r.test_case_id === tc.id);
      const status = result?.status ?? "no_run";
      if (status !== activeStatus) return false;
    }
    if (q) {
      const title = tc.title?.toLowerCase() ?? "";
      const id = String(tc.id);
      if (!title.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });
});

function handleSelectCaseId(caseId: number) {
  const match = props.results.find((r) => r.test_case_id === caseId);
  if (match) {
    emit("select", match);
  }
}

function clearFilters() {
  searchQuery.value = "";
  statusFilter.value = "all";
}
</script>

<template>
  <div class="test-results-list">
    <!-- Progress Summary -->
    <div class="progress-summary">
      <div class="run-info-bar" v-if="testRun || runProgress">
        <div v-if="testRun" class="stat-item">
          <span class="stat-label">Status</span>
          <Tag
            :value="
              RUN_STATUS_LABELS[testRun.status] ||
              statusLabel(testRun.status as string)
            "
            :severity="getRunStatusSeverity(testRun.status)"
          />
        </div>

        <div v-if="testRun" class="stat-item">
          <span class="stat-label">Created</span>
          <span class="stat-value">{{
            formatShortDate(testRun.created_at)
          }}</span>
        </div>

        <div v-if="testRun?.completed_at" class="stat-item">
          <span class="stat-label">Completed</span>
          <span class="stat-value">{{
            formatShortDate(testRun.completed_at)
          }}</span>
        </div>

        <div v-if="runProgress" class="stat-item highlight">
          <span class="stat-label">Pass Rate</span>
          <span class="stat-value pass-rate">{{
            formatPassRate(runProgress.pass_rate, { decimals: 1 })
          }}</span>
        </div>
      </div>

      <TestRunProgressBar :progress="segmentedProgress" />
      <div class="progress-passed-summary">
        {{ segmentedProgress.passed }} / {{ segmentedProgress.total }}
      </div>

      <div class="status-counts">
        <div
          v-for="status in RESULT_STATUSES"
          :key="status"
          class="status-count"
          :class="{ clickable: statusFilter !== status }"
          @click="statusFilter = status"
        >
          <span
            class="count-indicator"
            :style="{ backgroundColor: RESULT_STATUS_COLORS[status] }"
          ></span>
          <span class="count-label">{{ statusLabel(status) }}</span>
          <span class="count-value">{{
            progress[status as keyof typeof progress] || 0
          }}</span>
        </div>

        <div v-if="totalDefects > 0" class="status-count defect-count-chip">
          <i class="pi pi-bug defect-chip-icon"></i>
          <span class="count-label">Defects</span>
          <span class="count-value">{{ totalDefects }}</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <span class="p-input-icon-left search-input">
        <i class="pi pi-search" />
        <InputText v-model="searchQuery" placeholder="Search test cases..." />
      </span>

      <Select
        v-model="statusFilter"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Filter by status"
        class="status-filter"
        :showClear="statusFilter !== 'all'"
      />
    </div>

    <!-- Results Count -->
    <div class="results-count">
      <span>{{ filteredCases.length }} case(s)</span>
      <span
        v-if="searchQuery || statusFilter !== 'all'"
        class="filter-indicator"
      >
        (filtered)
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Loading test results...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredCases.length === 0" class="empty-state">
      <i class="pi pi-inbox"></i>
      <template v-if="results.length === 0">
        <p>No test cases in this run yet</p>
        <Button
          v-if="canEditCases"
          label="Add Cases"
          icon="pi pi-plus"
          @click="emit('edit-cases')"
          data-testid="empty-run-add-cases-btn"
        />
      </template>
      <template v-else>
        <p>No results match your filters</p>
        <Button
          v-if="searchQuery || statusFilter !== 'all'"
          label="Clear Filters"
          text
          @click="clearFilters"
        />
      </template>
    </div>

    <!-- Results List -->
    <div v-else class="results-container">
      <SuiteTreeResults
        v-if="testRun"
        :cases="filteredCases"
        :results="results"
        :suite-tree="suiteTree ?? []"
        mode="read"
        :selected-result="selectedResult"
        :run-id="testRun.id"
        @select="handleSelectCaseId"
      />
    </div>
  </div>
</template>

<style scoped>
.test-results-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background-color: var(--surface-ground);
  overflow: hidden;
}

.progress-summary {
  padding: 16px;
  background-color: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}

.progress-summary :deep(.progress-bar-segmented) {
  margin-bottom: 6px;
}

.progress-passed-summary {
  text-align: right;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  margin-bottom: 12px;
}

.run-info-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background-color: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
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
}

.stat-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-color);
}

.pass-rate {
  font-weight: 700;
  font-size: 1rem;
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


.status-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-count {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--surface-hover);
  border-radius: 4px;
  font-size: 0.75rem;
}

.status-count.clickable {
  cursor: pointer;
}

.status-count.clickable:hover {
  background-color: var(--surface-100);
}

.count-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.count-label {
  color: var(--text-color-secondary);
}

.count-value {
  font-weight: 600;
  color: var(--text-color);
}

.defect-count-chip {
  border: 1px solid var(--red-200, #fecaca);
}

.defect-chip-icon {
  font-size: 0.7rem;
  color: var(--red-500, #ef4444);
}

.filters-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}

.search-input {
  flex: 1;
}

.search-input :deep(input) {
  width: 100%;
}

.status-filter {
  min-width: 160px;
}

/* Clear icon styling inside dropdown */
.status-filter :deep(.p-dropdown-clear-icon) {
  position: absolute;
  right: 2.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-color-secondary);
  font-size: 0.75rem;
  cursor: pointer;
}

.status-filter :deep(.p-dropdown-clear-icon:hover) {
  color: var(--text-color);
}

.results-count {
  padding: 8px 16px;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  background-color: var(--surface-ground);
}

.filter-indicator {
  color: var(--primary-600, #5a6fd6);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  flex: 1;
}

.loading-state i,
.empty-state i {
  font-size: 2.5rem;
  color: var(--surface-400);
  margin-bottom: 12px;
}

.loading-state span,
.empty-state p {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin: 0;
}

.suite-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
}

.suite-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--surface-section);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-color);
  font-size: 0.8rem;
  font-weight: 600;
  width: 100%;
  text-align: left;
}

.suite-group-header:hover {
  background: var(--surface-hover);
}

.suite-group-header .pi {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

.suite-group-name {
  flex: 1;
}

.suite-group-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  background: var(--surface-200);
  padding: 1px 6px;
  border-radius: 10px;
}

.suite-group-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
}

.results-container {
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
  padding: 16px;
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Custom scrollbar styling */
.results-container::-webkit-scrollbar {
  width: 10px;
}

.results-container::-webkit-scrollbar-track {
  background: var(--surface-200);
  border-radius: 5px;
  margin: 8px 0;
}

.results-container::-webkit-scrollbar-thumb {
  background: var(--surface-400);
  border-radius: 5px;
  border: 2px solid var(--surface-200);
}

.results-container::-webkit-scrollbar-thumb:hover {
  background: var(--surface-500);
}

/* Firefox scrollbar */
.results-container {
  scrollbar-width: thin;
  scrollbar-color: var(--surface-400) var(--surface-200);
}
</style>
