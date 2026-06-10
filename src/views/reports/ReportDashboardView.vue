<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { debounce } from "lodash-es";
import { useProjectsStore } from "@/stores/projects";
import { useTestRunsStore } from "@/stores/testRuns";
import { useTestCasesStore } from "@/stores/testCases";
import { useTestResultsStore } from "@/stores/testResults";
import { useReportsStore } from "@/stores/reports";
import { useToast } from "primevue/usetoast";
import { usePdfExport } from "@/composables/usePdfExport";
import { useExcelExport } from "@/composables/useExcelExport";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import PerProjectBreakdown from "@/components/reports/PerProjectBreakdown.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import Tag from "primevue/tag";
import Select from "primevue/select";
import DatePicker from "primevue/datepicker";
import Dialog from "primevue/dialog";
import Checkbox from "primevue/checkbox";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler,
} from "chart.js";
import { Doughnut, Line, Bar } from "vue-chartjs";
import { RESULT_STATUS_COLORS } from "@/types/testResult";
import { toPercentRounded } from "@/utils/passRate";

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler,
);

const projectsStore = useProjectsStore();
const testRunsStore = useTestRunsStore();
const testCasesStore = useTestCasesStore();
const testResultsStore = useTestResultsStore();
const reportsStore = useReportsStore();
const toast = useToast();
const { exportToPdf, exporting: pdfExporting } = usePdfExport();
const { exportToExcel, exporting: excelExporting } = useExcelExport();

const exporting = ref(false);
const loading = computed(() => reportsStore.loading);

// Date range for trend chart — defaults to last 30 days
const defaultStart = new Date();
defaultStart.setDate(defaultStart.getDate() - 30);
const trendDateRange = ref<[Date, Date]>([defaultStart, new Date()]);

// Export dialog state
const showExportDialog = ref(false);
const exportType = ref<"pdf" | "excel">("pdf");
const selectedTestRunId = ref<number | null>(null);
const exportOptions = ref({
  includeSteps: true,
  includeComments: true,
  includeScreenshots: true,
  includeMetadata: true,
});

// Use global selected project from navbar; null = "All projects" mode.
const selectedProjectId = computed(() => projectsStore.selectedProjectId);

// Mode is derived from the global selector — single source of truth.
const mode = computed<"project" | "all">(() =>
  selectedProjectId.value ? "project" : "all",
);

const analytics = computed(() => reportsStore.analytics);
const crossProjectAnalytics = computed(() => reportsStore.crossProjectAnalytics);

// Active analytics payload — both shapes share `summary`, `runs`,
// `test_case_distribution`, and `trend`, so the chart-input computeds can
// consume either via this union.
const activeAnalytics = computed(() =>
  mode.value === "all" ? crossProjectAnalytics.value : analytics.value,
);

// Runs list for the export dialog dropdown — sourced from the active analytics
// payload. In 'all' mode each run carries `project_name` for disambiguation.
const projectTestRuns = computed(() => activeAnalytics.value?.runs ?? []);

// Metrics derived from the active aggregated response.
const metrics = computed(() => {
  const a = activeAnalytics.value;
  if (!a) return null;

  const automated = a.test_case_distribution.by_automation.automated ?? 0;
  const automationCoverage =
    a.summary.total_test_cases > 0
      ? toPercentRounded(automated / a.summary.total_test_cases) ?? 0
      : 0;

  return {
    total_test_cases: a.summary.total_test_cases,
    total_test_runs: a.summary.total_test_runs,
    total_test_results: a.summary.total_results,
    automation_coverage: automationCoverage,
    overall_pass_rate: toPercentRounded(a.summary.overall_pass_rate) ?? 0,
    priority_distribution: a.test_case_distribution.by_priority,
    type_distribution: a.test_case_distribution.by_type,
  };
});

// Per-project breakdown rows — populated only in 'all' mode.
const perProjectRows = computed(
  () => crossProjectAnalytics.value?.per_project ?? [],
);

// Trend series — backend already aggregates per-day within the window.
// `pass_rate` is propagated as `null` for empty days so Chart.js draws a gap
// (via `spanGaps`) instead of falsely plotting zero.
const trendData = computed(() => {
  const points = activeAnalytics.value?.trend ?? [];
  return points
    .filter((p) => p.total > 0)
    .slice(-10)
    .map((p) => ({
      date: p.date,
      pass_rate: toPercentRounded(p.pass_rate),
      total_tests: p.total,
      passed: p.passed,
      failed: p.failed,
    }));
});

// Pass rate trend line chart. Uses canonical passed-green for the pass-rate
// line to match the KPI + the rest of the dashboard. `null` data points render
// as gaps via `spanGaps` so quiet windows don't masquerade as zero.
const TREND_PASS_GREEN = RESULT_STATUS_COLORS.passed;
const TREND_PASS_FILL = "rgba(34, 197, 94, 0.1)";
const trendChartData = computed(() => {
  if (trendData.value.length === 0) {
    return {
      labels: ["No data"],
      datasets: [
        {
          label: "Pass Rate",
          data: [null as number | null],
          borderColor: TREND_PASS_GREEN,
          backgroundColor: TREND_PASS_FILL,
          tension: 0.4,
          fill: true,
          spanGaps: true,
          yAxisID: "y",
        },
        {
          label: "Total Tests",
          data: [0],
          borderColor: "#8b5cf6",
          backgroundColor: "transparent",
          tension: 0.4,
          borderDash: [5, 5],
          yAxisID: "y1",
        },
      ],
    };
  }

  return {
    labels: trendData.value.map((d) => {
      const date = new Date(d.date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }),
    datasets: [
      {
        label: "Pass Rate",
        data: trendData.value.map((d) => d.pass_rate),
        borderColor: TREND_PASS_GREEN,
        backgroundColor: TREND_PASS_FILL,
        tension: 0.4,
        fill: true,
        spanGaps: true,
        yAxisID: "y",
      },
      {
        label: "Total Tests",
        data: trendData.value.map((d) => d.total_tests),
        borderColor: "#8b5cf6",
        backgroundColor: "transparent",
        tension: 0.4,
        borderDash: [5, 5],
        yAxisID: "y1",
      },
    ],
  };
});

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index" as const,
    intersect: false,
  },
  plugins: {
    legend: {
      position: "top" as const,
    },
  },
  scales: {
    y: {
      type: "linear" as const,
      display: true,
      position: "left" as const,
      min: 0,
      max: 100,
      title: {
        display: true,
        text: "Pass Rate %",
      },
    },
    y1: {
      type: "linear" as const,
      display: true,
      position: "right" as const,
      grid: {
        drawOnChartArea: false,
      },
      title: {
        display: true,
        text: "Total Tests",
      },
    },
  },
};

// Priority distribution bar chart
const priorityChartData = computed(() => {
  if (!metrics.value?.priority_distribution) {
    return {
      labels: ["critical", "high", "medium", "low"],
      datasets: [
        {
          label: "Test Cases",
          data: [0, 0, 0, 0],
          backgroundColor: ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e"],
        },
      ],
    };
  }

  const priorities = ["critical", "high", "medium", "low"];
  const colors = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];

  return {
    labels: priorities,
    datasets: [
      {
        label: "Test Cases",
        data: priorities.map(
          (p) => metrics.value?.priority_distribution[p] || 0,
        ),
        backgroundColor: colors,
      },
    ],
  };
});

// Type distribution bar chart
const TYPE_COLORS: Record<string, string> = {
  automated: "#22c55e",
  manual: "#8b5cf6",
};
const TYPE_FALLBACK_PALETTE = ["#3b82f6", "#f59e0b", "#ef4444", "#14b8a6"];

const typeChartData = computed(() => {
  if (
    !metrics.value?.type_distribution ||
    Object.keys(metrics.value.type_distribution).length === 0
  ) {
    return {
      labels: ["No data"],
      datasets: [
        { label: "Test Cases", data: [0], backgroundColor: "#8b5cf6" },
      ],
    };
  }

  const types = Object.keys(metrics.value.type_distribution);
  let fallbackIdx = 0;
  const colors = types.map(
    (t) =>
      TYPE_COLORS[t] ??
      TYPE_FALLBACK_PALETTE[fallbackIdx++ % TYPE_FALLBACK_PALETTE.length],
  );

  return {
    labels: types,
    datasets: [
      {
        label: "Test Cases",
        data: types.map((t) => metrics.value?.type_distribution[t] || 0),
        backgroundColor: colors,
      },
    ],
  };
});

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
    },
  },
};

// Automation coverage doughnut
const automationChartData = computed(() => {
  if (!metrics.value) {
    return { labels: [], datasets: [] };
  }

  const automated = metrics.value.automation_coverage;
  const manual = 100 - automated;

  return {
    labels: ["Automated", "Manual"],
    datasets: [
      {
        data: [automated, manual],
        backgroundColor: ["#22c55e", "#94a3b8"],
        borderWidth: 0,
      },
    ],
  };
});

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom" as const,
    },
  },
  cutout: "70%",
};

async function loadMetrics() {
  const [startDate, endDate] = trendDateRange.value;
  const dateParams = {
    date_from: startDate ? startDate.toISOString() : undefined,
    date_to: endDate ? endDate.toISOString() : undefined,
  };
  try {
    if (mode.value === "all") {
      await reportsStore.fetchCrossProjectReportAnalytics(dateParams);
    } else {
      await reportsStore.fetchReportAnalytics(
        selectedProjectId.value as number,
        dateParams,
      );
    }
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to load report analytics",
      life: 5000,
    });
  }
}

const debouncedLoadMetrics = debounce(loadMetrics, 200);

// Open export dialog
async function openExportDialog(type: "pdf" | "excel") {
  if (!selectedProjectId.value) return;
  const projectId = selectedProjectId.value;

  exportType.value = type;

  // Default to the most recent completed test run, or first available
  const completedRuns = projectTestRuns.value.filter(
    (r) => r.status === "completed",
  );
  if (completedRuns.length > 0) {
    selectedTestRunId.value = completedRuns[0].id;
  } else if (projectTestRuns.value.length > 0) {
    selectedTestRunId.value = projectTestRuns.value[0].id;
  }

  showExportDialog.value = true;

  // Lazy-load test cases and full test runs for the export payload.
  // Dashboard charts run on the aggregated analytics response; the exporter
  // needs the richer TestRun / TestCase shapes.
  if (testCasesStore.getProjectCases(projectId).length === 0) {
    testCasesStore.fetchTestCases(projectId).catch(() => undefined);
  }
  if (!testRunsStore.allRuns[projectId]?.length) {
    testRunsStore.fetchTestRuns(projectId).catch(() => undefined);
  }
}

// Export to PDF with selected test run
async function handlePdfExport() {
  if (
    !selectedProjectId.value ||
    !projectsStore.selectedProject ||
    !selectedTestRunId.value
  )
    return;

  exporting.value = true;
  showExportDialog.value = false;

  try {
    toast.add({
      severity: "info",
      summary: "Generating PDF",
      detail: "Please wait while we prepare your report...",
      life: 3000,
    });

    // Fetch test results for selected test run
    await testResultsStore.fetchResults(selectedTestRunId.value);
    const testResults = testResultsStore.results;

    // Get selected test run from the runs store (exporter needs the full TestRun shape)
    const projectRuns = testRunsStore.allRuns[selectedProjectId.value] || [];
    const selectedTestRun = projectRuns.find(
      (r) => r.id === selectedTestRunId.value,
    );

    // Export to PDF
    await exportToPdf(
      {
        project: projectsStore.selectedProject,
        testRun: selectedTestRun,
        testCases: testCasesStore.getProjectCases(selectedProjectId.value),
        testResults: testResults,
      },
      exportOptions.value,
    );

    toast.add({
      severity: "success",
      summary: "Export Complete",
      detail: "PDF report has been downloaded",
      life: 3000,
    });
  } catch (error) {
    const err = error as Error;
    console.error("PDF export error:", err);
    toast.add({
      severity: "error",
      summary: "Export Failed",
      detail: err.message || "Failed to generate PDF report",
      life: 5000,
    });
  } finally {
    exporting.value = false;
  }
}

// Export to Excel with selected test run
async function handleExcelExport() {
  if (
    !selectedProjectId.value ||
    !projectsStore.selectedProject ||
    !selectedTestRunId.value
  )
    return;

  exporting.value = true;
  showExportDialog.value = false;

  try {
    toast.add({
      severity: "info",
      summary: "Generating Excel",
      detail: "Please wait while we prepare your report...",
      life: 3000,
    });

    // Fetch test results for selected test run
    await testResultsStore.fetchResults(selectedTestRunId.value);
    const testResults = testResultsStore.results;

    // Get selected test run from the runs store (exporter needs the full TestRun shape)
    const projectRuns = testRunsStore.allRuns[selectedProjectId.value] || [];
    const selectedTestRun = projectRuns.find(
      (r) => r.id === selectedTestRunId.value,
    );

    // Export to Excel
    await exportToExcel(
      {
        project: projectsStore.selectedProject,
        testRun: selectedTestRun,
        testCases: testCasesStore.getProjectCases(selectedProjectId.value),
        testResults: testResults,
      },
      {
        includeSteps: exportOptions.value.includeSteps,
        includeComments: exportOptions.value.includeComments,
        includeMetadata: exportOptions.value.includeMetadata,
      },
    );

    toast.add({
      severity: "success",
      summary: "Export Complete",
      detail: "Excel report has been downloaded",
      life: 3000,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Excel export error:", err);
    toast.add({
      severity: "error",
      summary: "Export Failed",
      detail: err.message || "Failed to generate Excel report",
      life: 5000,
    });
  } finally {
    exporting.value = false;
  }
}

// Handle export based on type
function handleExport() {
  if (exportType.value === "pdf") {
    handlePdfExport();
  } else {
    handleExcelExport();
  }
}

async function exportReport(format: "pdf" | "excel") {
  if (!selectedProjectId.value) return;
  openExportDialog(format);
}

watch(selectedProjectId, () => {
  // Wipe the inactive slot so a stale shape never leaks across modes while
  // the new fetch is in flight.
  if (mode.value === "all") {
    reportsStore.clearProjectAnalytics();
  } else {
    reportsStore.clearCrossProjectAnalytics();
  }
  loadMetrics();
});

watch(trendDateRange, () => {
  debouncedLoadMetrics();
});

function onSelectProjectFromBreakdown(projectId: number) {
  projectsStore.setSelectedProject(projectId);
}

onMounted(async () => {
  await projectsStore.fetchProjects();
  await loadMetrics();
});
</script>

<template>
  <DefaultLayout>
    <div class="report-dashboard-view">
      <div class="page-header">
        <div>
          <div class="title-row">
            <h1>Reports & Analytics</h1>
            <span
              v-if="projectsStore.selectedProject"
              class="project-filter-badge"
            >
              <i class="pi pi-folder"></i>
              {{ projectsStore.selectedProject.name }}
            </span>
            <span v-else class="project-filter-badge all-projects">
              <i class="pi pi-folder-open"></i>
              All projects
            </span>
          </div>
          <p class="subtitle">View detailed test metrics and trends</p>
        </div>
        <div
          class="header-actions"
          :title="
            mode === 'all' ? 'Select a single project to export' : undefined
          "
        >
          <Button
            label="Export PDF"
            icon="pi pi-file-pdf"
            severity="secondary"
            :loading="exporting"
            :disabled="mode === 'all'"
            @click="exportReport('pdf')"
          />
          <Button
            label="Export Excel"
            icon="pi pi-file-excel"
            severity="secondary"
            :loading="exporting"
            :disabled="mode === 'all'"
            @click="exportReport('excel')"
          />
        </div>
      </div>

      <template v-if="metrics">
        <!-- Summary Metrics -->
        <div class="summary-metrics">
          <Card class="summary-card">
            <template #content>
              <div class="summary-item">
                <span class="summary-value">{{
                  metrics.total_test_cases
                }}</span>
                <span class="summary-label">Test Cases</span>
              </div>
            </template>
          </Card>
          <Card class="summary-card">
            <template #content>
              <div class="summary-item">
                <span class="summary-value">{{ metrics.total_test_runs }}</span>
                <span class="summary-label">Test Runs</span>
              </div>
            </template>
          </Card>
          <Card class="summary-card">
            <template #content>
              <div class="summary-item">
                <span class="summary-value">{{
                  metrics.total_test_results
                }}</span>
                <span class="summary-label">Test Results</span>
              </div>
            </template>
          </Card>
          <Card class="summary-card highlight">
            <template #content>
              <div class="summary-item">
                <span class="summary-value pass-rate-value">
                  {{ metrics.overall_pass_rate }}%
                </span>
                <span class="summary-label">Overall Pass Rate</span>
              </div>
            </template>
          </Card>
        </div>

        <!-- Main Charts Row -->
        <div class="charts-row">
          <Card class="chart-card wide">
            <template #title>Pass Rate Trend</template>
            <template #subtitle>Historical performance over time</template>
            <template #content>
              <div class="trend-controls">
                <DatePicker
                  v-model="trendDateRange"
                  selectionMode="range"
                  :manualInput="false"
                  showIcon
                  dateFormat="M d, yy"
                  placeholder="Select date range"
                  class="trend-date-picker"
                />
              </div>
              <div class="chart-container-large">
                <Line
                  :key="'trend-' + trendData.length"
                  :data="trendChartData"
                  :options="trendChartOptions"
                />
              </div>
            </template>
          </Card>
        </div>

        <!-- Distribution Charts Row -->
        <div class="charts-row three-col">
          <Card class="chart-card">
            <template #title>Priority Distribution</template>
            <template #content>
              <div class="chart-container">
                <Bar :data="priorityChartData" :options="barChartOptions" />
              </div>
            </template>
          </Card>

          <Card class="chart-card">
            <template #title>Test Type Distribution</template>
            <template #content>
              <div class="chart-container">
                <Bar :data="typeChartData" :options="barChartOptions" />
              </div>
            </template>
          </Card>

          <Card class="chart-card">
            <template #title>Automation Coverage</template>
            <template #content>
              <div class="chart-container">
                <Doughnut
                  :data="automationChartData"
                  :options="doughnutOptions"
                />
              </div>
              <div class="coverage-label">
                <span class="coverage-value"
                  >{{ metrics.automation_coverage }}%</span
                >
                <span class="coverage-text">Automated</span>
              </div>
            </template>
          </Card>
        </div>

        <!-- Per-project breakdown — only in All-projects mode -->
        <Card v-if="mode === 'all'" class="breakdown-card">
          <template #content>
            <PerProjectBreakdown
              :rows="perProjectRows"
              @select="onSelectProjectFromBreakdown"
            />
          </template>
        </Card>

        <!-- Insights Section -->
        <Card v-if="mode === 'project'" class="insights-card">
          <template #title>
            <div class="insights-header">
              <i class="pi pi-lightbulb"></i>
              <span>Insights & Recommendations</span>
            </div>
          </template>
          <template #content>
            <div class="insights-list">
              <div v-if="metrics.automation_coverage < 50" class="insight info">
                <Tag severity="info" value="Automation" />
                <span
                  >Automation coverage is {{ metrics.automation_coverage }}%.
                  Consider automating more test cases to improve
                  efficiency.</span
                >
              </div>
              <div
                v-if="
                  (metrics.priority_distribution['critical'] ?? 0) >
                  metrics.total_test_cases * 0.3
                "
                class="insight danger"
              >
                <Tag severity="danger" value="Priority" />
                <span
                  >High number of critical test cases. Ensure these are executed
                  with every release.</span
                >
              </div>
            </div>
          </template>
        </Card>
      </template>

      <template v-else-if="!loading">
        <Card class="empty-state-card">
          <template #content>
            <div class="empty-state">
              <i class="pi pi-chart-bar"></i>
              <h3>No data to show</h3>
              <p>
                There are no projects with test data yet. Create a project and
                run some tests to see analytics here.
              </p>
            </div>
          </template>
        </Card>
      </template>

      <!-- Export Dialog (PDF/Excel) -->
      <Dialog
        v-model:visible="showExportDialog"
        :header="
          exportType === 'pdf' ? 'Export PDF Report' : 'Export Excel Report'
        "
        :modal="true"
        :style="{ width: '500px' }"
        :closable="true"
      >
        <div class="export-dialog-content">
          <div class="field mb-4">
            <label for="testRun" class="block mb-2 font-medium">Test Run</label>
            <Select
              id="testRun"
              v-model="selectedTestRunId"
              :options="projectTestRuns"
              optionLabel="name"
              optionValue="id"
              placeholder="Select a test run"
              class="w-full"
              showClear
            >
              <template #option="{ option }">
                <div class="flex align-items-center gap-2">
                  <span v-if="option.project_name" class="run-option-project">
                    {{ option.project_name }} ·
                  </span>
                  <span>{{ option.name }}</span>
                  <Tag
                    :value="option.status"
                    :severity="
                      option.status === 'completed'
                        ? 'success'
                        : option.status === 'active'
                          ? 'warning'
                          : option.status === 'planned'
                            ? 'info'
                            : 'secondary'
                    "
                    class="ml-auto"
                  />
                </div>
              </template>
            </Select>
          </div>

          <div class="field mb-3">
            <label class="block mb-2 font-medium">Include in Report</label>
            <div class="export-options">
              <div class="export-option">
                <Checkbox
                  v-model="exportOptions.includeSteps"
                  inputId="includeSteps"
                  :binary="true"
                />
                <label for="includeSteps">Test Steps</label>
              </div>
              <div class="export-option">
                <Checkbox
                  v-model="exportOptions.includeComments"
                  inputId="includeComments"
                  :binary="true"
                />
                <label for="includeComments">Comments</label>
              </div>
              <div v-if="exportType === 'pdf'" class="export-option">
                <Checkbox
                  v-model="exportOptions.includeScreenshots"
                  inputId="includeScreenshots"
                  :binary="true"
                />
                <label for="includeScreenshots">Screenshots</label>
              </div>
              <div class="export-option">
                <Checkbox
                  v-model="exportOptions.includeMetadata"
                  inputId="includeMetadata"
                  :binary="true"
                />
                <label for="includeMetadata">Metadata (Priority, Type)</label>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="export-dialog-footer">
            <Button
              label="Cancel"
              severity="secondary"
              text
              @click="showExportDialog = false"
            />
            <Button
              :label="exportType === 'pdf' ? 'Export PDF' : 'Export Excel'"
              :icon="
                exportType === 'pdf' ? 'pi pi-file-pdf' : 'pi pi-file-excel'
              "
              :loading="pdfExporting || excelExporting"
              :disabled="!selectedTestRunId"
              @click="handleExport"
            />
          </div>
        </template>
      </Dialog>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.subtitle {
  color: var(--text-color-secondary);
  margin: 4px 0 0 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.summary-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 1000px) {
  .summary-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .summary-metrics {
    grid-template-columns: 1fr;
  }
}

.summary-card {
  border-radius: 12px;
  text-align: center;
}

.summary-card.highlight {
  border: 2px solid var(--primary-200);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-color);
}

.summary-value.pass-rate-value {
  color: var(--status-passed);
}

.summary-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.charts-row {
  display: grid;
  gap: 24px;
  margin-bottom: 24px;
}

.charts-row.three-col {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 1200px) {
  .charts-row.three-col {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .charts-row.three-col {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  border-radius: 12px;
}

.chart-card.wide {
  grid-column: 1 / -1;
}

.chart-container {
  height: 250px;
  position: relative;
}

.trend-controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.trend-date-picker {
  width: 280px;
}

.chart-container-large {
  height: 350px;
  position: relative;
}

.coverage-label {
  text-align: center;
  margin-top: 16px;
}

.coverage-value {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: #22c55e;
}

.coverage-text {
  display: block;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.insights-card {
  border-radius: 12px;
  margin-bottom: 24px;
}

.insights-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.insights-header i {
  color: #f59e0b;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--surface-ground);
}

.insight.success {
  border-left: 4px solid #22c55e;
}

.insight.warning {
  border-left: 4px solid #f59e0b;
}

.insight.danger {
  border-left: 4px solid #ef4444;
}

.insight.info {
  border-left: 4px solid #3b82f6;
}

.insight span:last-child {
  color: var(--text-color);
  font-size: 14px;
  line-height: 1.5;
}

.empty-state-card {
  border-radius: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px;
  color: var(--text-color-secondary);
}

.empty-state i {
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.empty-state p {
  margin: 0;
  text-align: center;
}

/* Export Dialog Styles */
.export-dialog-content {
  padding: 0.5rem 0;
}

.export-dialog-content :deep(#testRun) {
  width: 100%;
}

/* Hide dropdown arrow when clear button is visible (item selected) */
.export-dialog-content :deep(.p-dropdown-clear-icon + .p-dropdown-trigger) {
  display: none;
}

/* Position clear icon properly */
.export-dialog-content :deep(.p-dropdown-clear-icon) {
  top: 14px;
  right: 10px;
}

/* Add space between selected text and clear icon */
.export-dialog-content :deep(.p-dropdown .p-dropdown-label) {
  padding-right: 2rem;
}

.export-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.export-option label {
  cursor: pointer;
  user-select: none;
}

.text-muted {
  color: var(--text-color-secondary);
  display: block;
  margin-top: 4px;
}

.export-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.project-filter-badge.all-projects {
  background: var(--surface-100, #f1f5f9);
  color: var(--text-color-secondary, #64748b);
}

.run-option-project {
  color: var(--text-color-secondary, #64748b);
  font-size: 0.875rem;
}

.breakdown-card {
  border-radius: 12px;
  margin-bottom: 24px;
}
</style>
