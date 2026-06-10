<script setup lang="ts">
import { ref, onMounted, computed, watch, defineAsyncComponent } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useProjectsStore } from "@/stores/projects";
import { useTestRunsStore } from "@/stores/testRuns";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ProgressBar from "primevue/progressbar";
import Select from "primevue/select";
import { RESULT_STATUS_COLORS } from "@/types/testResult";
import { statusLabel } from "@/utils/statusLabel";
import { formatPassRate, toPercent, toPercentRounded } from "@/utils/passRate";

const LineChart = defineAsyncComponent(
  () => import("@/components/charts/LineChart.vue"),
);
const DoughnutChart = defineAsyncComponent(
  () => import("@/components/charts/DoughnutChart.vue"),
);

const router = useRouter();
const authStore = useAuthStore();
const projectsStore = useProjectsStore();
const testRunsStore = useTestRunsStore();

const loading = ref(false);

// Local Dashboard-only run filter. When set, metric cards, the doughnut chart,
// and the recent-runs list scope to just this one run. Cleared whenever the
// selected project changes.
const selectedRunId = ref<number | null>(null);

// Get test runs based on selected project (from allRuns cache) — used by the
// trend line, results doughnut, and the recent-runs list. Metrics cards and
// the overall pass rate now come from the aggregated /projects/stats endpoint.
const filteredTestRuns = computed(() => {
  if (projectsStore.selectedProjectId) {
    return testRunsStore.allRuns[projectsStore.selectedProjectId] || [];
  }
  return testRunsStore.allRunsFlat;
});

const runOptions = computed(() =>
  [...filteredTestRuns.value]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .map((r) => ({ id: r.id, name: r.name, status: r.status })),
);

const selectedRun = computed(() =>
  selectedRunId.value != null
    ? filteredTestRuns.value.find((r) => r.id === selectedRunId.value) ?? null
    : null,
);

// Bulk stats scoped to the current view: one row when a project is selected,
// every active project otherwise.
const scopedBulkStats = computed(() => {
  if (projectsStore.selectedProjectId) {
    return projectsStore.bulkStats.filter(
      (s) => s.project_id === projectsStore.selectedProjectId,
    );
  }
  return projectsStore.bulkStats.filter((s) => !s.is_archived);
});

const metrics = computed(() => {
  const projects = projectsStore.selectedProjectId
    ? projectsStore.projects.filter(
        (p) => p.id === projectsStore.selectedProjectId,
      )
    : projectsStore.projects.filter((p) => !p.is_archived);

  const run = selectedRun.value;
  if (run) {
    return {
      totalProjects: projects.length,
      totalTestCases: run.progress?.total ?? 0,
      totalTestRuns: 1,
      activeRuns:
        run.status === "planned" || run.status === "active" ? 1 : 0,
    };
  }

  const stats = scopedBulkStats.value;
  const totalTestCases = stats.reduce((sum, s) => sum + s.total_test_cases, 0);
  const totalTestRuns = stats.reduce((sum, s) => sum + s.total_test_runs, 0);
  const activeRuns = stats.reduce((sum, s) => sum + s.active_runs, 0);

  return {
    totalProjects: projects.length,
    totalTestCases,
    totalTestRuns,
    activeRuns,
  };
});

// Overall pass rate = arithmetic mean of each completed run's own pass rate,
// scoped to the current project filter (or to the single selected run). Runs
// with no results (`pass_rate == null`) don't contribute. Backend applies the
// same rule to each `s.pass_rate` row — the per-project breakdown numbers come
// straight from bulk stats.
const passRateData = computed(() => {
  const perProject = scopedBulkStats.value
    .map((s) => ({
      projectId: s.project_id,
      name: s.name,
      passRate: toPercentRounded(s.pass_rate),
      runCount: s.total_test_runs,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const run = selectedRun.value;
  if (run) {
    const overall = toPercentRounded(run.progress?.pass_rate);
    return { overall, perProject };
  }

  const completedRates = filteredTestRuns.value
    .filter((r) => r.status === "completed" && r.progress?.pass_rate != null)
    .map((r) => toPercent(r.progress!.pass_rate))
    .filter((v): v is number => v != null);
  const overall =
    completedRates.length > 0
      ? Math.round(
          (completedRates.reduce((sum, v) => sum + v, 0) /
            completedRates.length) *
            10,
        ) / 10
      : null;
  return { overall, perProject };
});

const passRateBreakdown = computed(() =>
  passRateData.value.perProject.slice(0, 5),
);

const hasMoreProjects = computed(
  () => passRateData.value.perProject.length > 5,
);

// Status distribution for doughnut chart (filtered by project, and optionally
// narrowed to a single run via the Select Run dropdown).
const statusDistribution = computed(() => {
  const runs = selectedRun.value ? [selectedRun.value] : filteredTestRuns.value;
  let passed = 0,
    failed = 0,
    blocked = 0,
    no_run = 0;

  runs.forEach((run) => {
    if (run.progress) {
      passed += run.progress.passed ?? 0;
      failed += run.progress.failed ?? 0;
      blocked += run.progress.blocked ?? 0;
      no_run += run.progress.no_run ?? 0;
    }
  });

  return { passed, failed, blocked, no_run };
});

const hasDistribution = computed(() => {
  const d = statusDistribution.value;
  return d.passed + d.failed + d.blocked + d.no_run > 0;
});

// Doughnut chart data
const DISTRIBUTION_ORDER = ["passed", "failed", "blocked", "no_run"] as const;
const doughnutData = computed(() => ({
  labels: DISTRIBUTION_ORDER.map((s) => statusLabel(s)),
  datasets: [
    {
      data: DISTRIBUTION_ORDER.map((s) => statusDistribution.value[s]),
      backgroundColor: DISTRIBUTION_ORDER.map((s) => RESULT_STATUS_COLORS[s]),
      borderWidth: 0,
    },
  ],
}));

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right" as const,
      labels: {
        usePointStyle: true,
        padding: 16,
      },
    },
  },
  cutout: "60%",
};

// Calculate trend data from real test runs grouped by week
const trendData = computed(() => {
  const runs = filteredTestRuns.value;
  const completedRuns = runs.filter(
    (r) => r.status === "completed" && r.progress && r.completed_at,
  );

  if (completedRuns.length === 0) {
    return {
      labels: [] as string[],
      datasets: [
        {
          label: "Pass Rate %",
          data: [] as number[],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }

  // Group runs by week
  const weekMap = new Map<
    string,
    { total: number; passed: number; count: number }
  >();

  completedRuns.forEach((run) => {
    const date = new Date(run.completed_at || run.created_at);
    // Get week start (Monday)
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const weekKey = weekStart.toISOString().split("T")[0];

    const existing = weekMap.get(weekKey) || { total: 0, passed: 0, count: 0 };
    existing.total += run.progress!.total;
    existing.passed += run.progress!.passed;
    existing.count++;
    weekMap.set(weekKey, existing);
  });

  // Sort weeks and take last 6
  const sortedWeeks = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);

  // Generate labels and data
  const labels = sortedWeeks.map(([weekKey]) => {
    const date = new Date(weekKey);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const data = sortedWeeks.map(([, stats]) => {
    if (stats.total === 0) return 0;
    return toPercentRounded(stats.passed / stats.total) ?? 0;
  });

  return {
    labels,
    datasets: [
      {
        label: "Pass Rate %",
        data,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };
});

const hasTrendData = computed(() => trendData.value.labels.length > 0);

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: {
        callback: (value: string | number) => value + "%",
      },
    },
  },
};

function getRunStatusSeverity(status: string) {
  const map: Record<string, "success" | "danger" | "warning" | "secondary"> = {
    planned: "secondary",
    active: "warning",
    completed: "success",
    aborted: "danger",
  };
  return map[status] || "secondary";
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Recent runs filtered by selected project (or narrowed to one run).
const recentRunsFiltered = computed(() => {
  if (selectedRun.value) return [selectedRun.value];
  return [...filteredTestRuns.value]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5);
});

const initializedRef = ref(false);

async function loadDashboardData() {
  loading.value = true;
  try {
    await projectsStore.fetchProjects();

    const activeProjects = projectsStore.projects.filter((p) => !p.is_archived);
    const projectIds = activeProjects.map((p) => p.id);
    const selectedId = projectsStore.selectedProjectId;

    // One round-trip for the summary metrics + overall pass rate across the
    // whole scope. Runs are still fetched — the trend line, results doughnut,
    // and recent-runs list need row-level data that's not in the bulk stats.
    const statsPromise = projectsStore.fetchBulkStats(
      selectedId ? { project_ids: [selectedId] } : {},
    );

    if (selectedId) {
      await Promise.all([
        statsPromise,
        testRunsStore.fetchRunsForDashboard(selectedId),
      ]);
    } else if (projectIds.length > 0) {
      await Promise.all([
        statsPromise,
        testRunsStore.fetchAllRunsForDashboard(projectIds),
      ]);
    } else {
      await statsPromise;
    }
  } finally {
    loading.value = false;
  }
}

// Watch for project selection changes and reload data (skip initial). Also
// clear any active run filter so stale run ids from the prior project don't
// leak into metrics/charts.
watch(
  () => projectsStore.selectedProjectId,
  async () => {
    selectedRunId.value = null;
    if (!initializedRef.value) return;
    await loadDashboardData();
  },
);

onMounted(async () => {
  await loadDashboardData();
  initializedRef.value = true;
});
</script>

<template>
  <DefaultLayout>
    <div class="dashboard-view" data-testid="dashboard-view">
      <div class="page-header">
        <div>
          <div class="title-row">
            <h1>Dashboard</h1>
            <span
              v-if="projectsStore.selectedProject"
              class="project-filter-badge"
            >
              <i class="pi pi-folder"></i>
              {{ projectsStore.selectedProject.name }}
            </span>
          </div>
          <p class="welcome-text">
            Welcome back,
            {{ authStore.user?.full_name || authStore.user?.username }}
          </p>
        </div>
        <div class="header-actions">
          <Select
            v-model="selectedRunId"
            :options="runOptions"
            optionLabel="name"
            optionValue="id"
            placeholder="All runs"
            class="run-filter"
            showClear
            :disabled="runOptions.length === 0"
          >
            <template #option="{ option }">
              <div class="run-option">
                <span class="run-option-name">{{ option.name }}</span>
                <Tag
                  :value="option.status"
                  :severity="getRunStatusSeverity(option.status)"
                />
              </div>
            </template>
          </Select>
          <Button
            v-if="authStore.canManageTests"
            label="New Test Run"
            icon="pi pi-play"
            @click="router.push('/test-runs/create')"
          />
        </div>
      </div>

      <!-- Metrics Cards -->
      <div class="metrics-grid">
        <Card class="metric-card">
          <template #content>
            <div class="metric">
              <div
                class="metric-icon-wrapper"
                style="background: rgba(102, 126, 234, 0.1)"
              >
                <i class="pi pi-folder" style="color: #667eea"></i>
              </div>
              <div class="metric-info">
                <span class="metric-value">{{ metrics.totalProjects }}</span>
                <span class="metric-label">Active Projects</span>
              </div>
            </div>
          </template>
        </Card>

        <Card class="metric-card">
          <template #content>
            <div class="metric">
              <div
                class="metric-icon-wrapper"
                style="background: rgba(34, 197, 94, 0.1)"
              >
                <i class="pi pi-file-edit" style="color: #22c55e"></i>
              </div>
              <div class="metric-info">
                <span class="metric-value">{{ metrics.totalTestCases }}</span>
                <span class="metric-label">Test Cases</span>
              </div>
            </div>
          </template>
        </Card>

        <Card class="metric-card">
          <template #content>
            <div class="metric">
              <div
                class="metric-icon-wrapper"
                style="background: rgba(245, 158, 11, 0.1)"
              >
                <i class="pi pi-play" style="color: #f59e0b"></i>
              </div>
              <div class="metric-info">
                <span class="metric-value">{{ metrics.activeRuns }}</span>
                <span class="metric-label">Active Runs</span>
              </div>
            </div>
          </template>
        </Card>

        <Card class="metric-card highlight">
          <template #content>
            <div class="metric">
              <div
                class="metric-icon-wrapper"
                style="background: rgba(59, 130, 246, 0.1)"
              >
                <i class="pi pi-chart-line" style="color: #3b82f6"></i>
              </div>
              <div class="metric-info">
                <span class="metric-value pass-rate-value">
                  {{
                    passRateData.overall !== null
                      ? passRateData.overall + "%"
                      : "\u2014"
                  }}
                </span>
                <span class="metric-label">Overall Pass Rate</span>
                <span class="metric-sublabel">
                  {{
                    selectedRun
                      ? `Run: ${selectedRun.name}`
                      : passRateData.overall !== null
                        ? "Average across completed runs"
                        : "No completed runs yet"
                  }}
                </span>
              </div>
            </div>
            <div
              v-if="
                passRateBreakdown.length > 1 ||
                (passRateBreakdown.length === 1 &&
                  !projectsStore.selectedProjectId)
              "
              class="pass-rate-breakdown"
            >
              <div
                v-for="row in passRateBreakdown"
                :key="row.projectId"
                class="breakdown-row"
              >
                <span class="breakdown-name">{{ row.name }}</span>
                <span class="breakdown-rate">{{
                  row.passRate !== null ? row.passRate + "%" : "\u2014"
                }}</span>
                <ProgressBar
                  v-if="row.passRate !== null"
                  :value="row.passRate"
                  :showValue="false"
                  class="breakdown-bar"
                />
              </div>
              <Button
                v-if="hasMoreProjects"
                label="View all in Reports"
                text
                size="small"
                icon="pi pi-arrow-right"
                iconPos="right"
                @click="router.push('/reports')"
                class="view-all-link"
              />
            </div>
          </template>
        </Card>
      </div>

      <!-- Charts Row -->
      <div class="charts-row">
        <Card class="chart-card">
          <template #title>Pass Rate Trend</template>
          <template #subtitle>
            {{
              projectsStore.selectedProject
                ? projectsStore.selectedProject.name
                : "All projects"
            }}
            - Weekly pass rate from completed runs
          </template>
          <template #content>
            <div class="chart-container">
              <LineChart
                v-if="hasTrendData"
                :data="trendData"
                :options="lineOptions"
              />
              <div v-else class="chart-empty">No completed runs yet</div>
            </div>
          </template>
        </Card>

        <Card class="chart-card">
          <template #title>Test Results Distribution</template>
          <template #subtitle>
            {{
              projectsStore.selectedProject
                ? projectsStore.selectedProject.name
                : "Across all projects"
            }}
          </template>
          <template #content>
            <div class="chart-container">
              <DoughnutChart
                v-if="hasDistribution"
                :data="doughnutData"
                :options="doughnutOptions"
              />
              <div v-else class="chart-empty">No activity yet</div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Recent Test Runs -->
      <Card class="recent-runs-card">
        <template #title>
          <div class="card-header">
            <span>Recent Test Runs</span>
            <Button
              label="View All"
              text
              size="small"
              @click="router.push('/test-runs')"
            />
          </div>
        </template>
        <template #content>
          <div v-if="recentRunsFiltered.length > 0" class="recent-runs-list">
            <div
              v-for="run in recentRunsFiltered"
              :key="run.id"
              class="run-item"
              @click="router.push(`/test-runs/${run.id}`)"
            >
              <div class="run-info">
                <span class="run-name">{{ run.name }}</span>
                <span class="run-date">{{ formatDate(run.created_at) }}</span>
              </div>
              <div class="run-stats">
                <Tag
                  :value="run.status"
                  :severity="getRunStatusSeverity(run.status)"
                />
                <div v-if="run.progress" class="run-progress">
                  <div class="progress-mini">
                    <div
                      class="progress-mini-fill"
                      :style="{
                        width: (toPercent(run.progress.pass_rate) ?? 0) + '%',
                      }"
                    ></div>
                  </div>
                  <span class="progress-label">{{
                    formatPassRate(run.progress.pass_rate)
                  }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-runs">
            <i class="pi pi-inbox"></i>
            <p>No recent test runs</p>
            <Button
              v-if="authStore.canManageTests"
              label="Create Test Run"
              @click="router.push('/test-runs/create')"
            />
          </div>
        </template>
      </Card>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <Card>
          <template #title>Quick Actions</template>
          <template #content>
            <div class="actions-grid">
              <Button
                label="Browse Projects"
                icon="pi pi-folder"
                severity="secondary"
                outlined
                @click="router.push('/projects')"
              />
              <Button
                v-if="authStore.isProjectManager"
                label="Create Test Case"
                icon="pi pi-plus"
                severity="secondary"
                outlined
                @click="router.push('/projects/1/test-cases')"
              />
              <Button
                label="View Reports"
                icon="pi pi-chart-bar"
                severity="secondary"
                outlined
                @click="router.push('/reports')"
              />
              <Button
                v-if="authStore.canManageTests"
                label="Start New Run"
                icon="pi pi-play"
                severity="secondary"
                outlined
                @click="router.push('/test-runs/create')"
              />
            </div>
          </template>
        </Card>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.dashboard-view {
  padding: 0;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 180px;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
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

.welcome-text {
  color: var(--text-color-secondary);
  margin: 4px 0 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.run-filter {
  min-width: 220px;
}

.run-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.run-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 1200px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}

.metric-card {
  border-radius: 12px;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.metric-card.highlight {
  border: 2px solid var(--primary-200);
}

.metric {
  display: flex;
  align-items: center;
  gap: 16px;
}

.metric-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-icon-wrapper i {
  font-size: 1.5rem;
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-color);
}

.metric-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.metric-sublabel {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  opacity: 0.8;
  margin-top: 2px;
}

.metric-value.pass-rate-value {
  color: var(--status-passed);
}

.pass-rate-breakdown {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breakdown-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breakdown-name {
  flex: 1;
  font-size: 0.8rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.breakdown-rate {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-color);
  min-width: 40px;
  text-align: right;
}

.breakdown-bar {
  width: 60px;
  height: 6px;
  flex-shrink: 0;
}

.breakdown-bar :deep(.p-progressbar-value) {
  background-color: var(--status-passed);
}

.view-all-link {
  align-self: flex-end;
  margin-top: 4px;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

@media (max-width: 900px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  border-radius: 12px;
}

.chart-container {
  height: 280px;
  position: relative;
}

.recent-runs-card {
  margin-bottom: 24px;
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recent-runs-list {
  display: flex;
  flex-direction: column;
}

.run-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
  transition: background 0.2s;
}

.run-item:hover {
  background: var(--surface-hover);
  margin: 0 -16px;
  padding: 16px;
  border-radius: 8px;
}

.run-item:last-child {
  border-bottom: none;
}

.run-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.run-name {
  font-weight: 500;
  color: var(--text-color);
}

.run-date {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.run-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.run-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
}

.progress-mini {
  position: relative;
  width: 60px;
  height: 6px;
  background-color: var(--surface-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-mini-fill {
  height: 100%;
  background-color: var(--success-color);
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color);
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}

.empty-runs {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: var(--text-color-secondary);
}

.empty-runs i {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-runs p {
  margin-bottom: 16px;
}

.quick-actions {
  margin-bottom: 24px;
}

.actions-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .title-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .welcome-text {
    font-size: 0.875rem;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .run-filter {
    width: 100%;
  }

  .run-stats {
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .run-progress {
    min-width: auto;
  }

  .actions-grid {
    flex-direction: column;
  }

  .actions-grid :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .chart-container {
    height: 220px;
  }
}

@media (max-width: 480px) {
  .page-header h1 {
    font-size: 20px;
  }

  .run-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .run-stats {
    flex-direction: row;
    width: 100%;
    justify-content: space-between;
  }
}
</style>
