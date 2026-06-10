<script setup lang="ts">
import { onMounted, computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useProjectsStore } from "@/stores/projects";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ConfirmDialog from "primevue/confirmdialog";
import Menu from "primevue/menu";
import type { MenuItem } from "primevue/menuitem";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useTestRunsStore } from "@/stores/testRuns";
import { useAuthStore } from "@/stores/auth";
import type { TestRun } from "@/types/testRun";
import { RUN_STATUS_LABELS } from "@/types/testRun";
import { useTestResultsStore } from "@/stores/testResults";
import EditTestRunDialog from "@/components/test-runs/EditTestRunDialog.vue";
import { toPercentRounded } from "@/utils/passRate";
import EditRunCasesDialog from "@/components/test-runs/EditRunCasesDialog.vue";

const router = useRouter();
const projectsStore = useProjectsStore();
const testRunsStore = useTestRunsStore();
const testResultsStore = useTestResultsStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const testRuns = computed(() => testRunsStore.testRuns);
const loading = computed(() => testRunsStore.loading);

const editRunTarget = ref<TestRun | null>(null);
const showEditRunDialog = ref(false);
const editCasesTarget = ref<TestRun | null>(null);
const editCasesInitialIds = ref<number[]>([]);
const showEditCasesDialog = ref(false);
const loadingEditCases = ref(false);

const rowMenu = ref();
const rowMenuItems = ref<MenuItem[]>([]);

function toggleRowMenu(event: Event, testRun: TestRun) {
  const isCompleted = testRun.status === "completed";
  rowMenuItems.value = [
    {
      label: "Edit run",
      icon: "pi pi-pencil",
      command: () => openEditRun(testRun),
    },
    {
      label: "Edit cases",
      icon: "pi pi-list-check",
      disabled: isCompleted,
      command: () => openEditCases(testRun),
    },
    { separator: true },
    {
      label: "Delete",
      icon: "pi pi-trash",
      class: "row-menu-danger",
      command: () => confirmDeleteTestRun(testRun),
    },
  ];
  rowMenu.value.toggle(event);
}

function openEditRun(testRun: TestRun) {
  editRunTarget.value = testRun;
  showEditRunDialog.value = true;
}

async function openEditCases(testRun: TestRun) {
  if (loadingEditCases.value) return;
  loadingEditCases.value = true;
  try {
    await testResultsStore.fetchRunCasesWithResults(testRun.id);
    editCasesInitialIds.value = testResultsStore.runCases.map((c) => c.id);
    editCasesTarget.value = testRun;
    showEditCasesDialog.value = true;
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to load run cases",
      life: 5000,
    });
  } finally {
    loadingEditCases.value = false;
  }
}

async function fetchTestRuns() {
  if (!projectsStore.selectedProjectId) return;
  try {
    await testRunsStore.fetchTestRuns(projectsStore.selectedProjectId);
  } catch {
    // error is in store
  }
}

watch(
  () => projectsStore.selectedProjectId,
  () => {
    fetchTestRuns();
  },
);

onMounted(() => {
  if (!projectsStore.selectedProjectId) {
    projectsStore
      .fetchProjects()
      .then(() => {
        if (
          projectsStore.projects.length > 0 &&
          !projectsStore.selectedProjectId
        ) {
          projectsStore.setSelectedProject(projectsStore.projects[0].id);
        }
      })
      .catch(() => {});
  } else {
    fetchTestRuns();
  }
});

function viewTestRun(event: { data: { id: number } }) {
  router.push(`/test-runs/${event.data.id}`);
}

function confirmDeleteTestRun(testRun: TestRun) {
  confirm.require({
    message: `Are you sure you want to delete "${testRun.name}"? This will also delete all results in this run. This action cannot be undone.`,
    header: "Delete Test Run",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: () => handleDeleteTestRun(testRun.id),
    reject: () => {},
  });
}

async function handleDeleteTestRun(id: number) {
  try {
    await testRunsStore.deleteTestRun(id);
    toast.add({
      severity: "success",
      summary: "Deleted",
      detail: "Test run deleted successfully",
      life: 3000,
    });
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

function getStatusSeverity(status: string) {
  const map: Record<string, "success" | "info" | "warning" | "danger"> = {
    planned: "info",
    active: "warning",
    completed: "success",
    aborted: "danger",
  };
  return map[status] || "info";
}

// Pass rate as a 0..100 number (rounded to 1 decimal). Used for both the
// progress-bar width and the displayed text — same value, two consumers.
function calculatePassRate(
  progress: { passed: number; total: number } | null | undefined,
): number {
  if (!progress || progress.total === 0) return 0;
  return toPercentRounded(progress.passed / progress.total) ?? 0;
}

</script>

<template>
  <DefaultLayout>
    <ConfirmDialog />
    <div class="test-run-list-view">
      <div class="page-header">
        <div class="header-title">
          <h1>Test Runs</h1>
          <span
            v-if="projectsStore.selectedProject"
            class="project-filter-badge"
          >
            <i class="pi pi-folder"></i>
            {{ projectsStore.selectedProject.name }}
          </span>
        </div>
        <Button
          v-if="authStore.canManageTests"
          label="Create Test Run"
          icon="pi pi-plus"
          @click="router.push('/test-runs/create')"
        />
      </div>

      <DataTable
        :value="testRuns"
        :loading="loading"
        stripedRows
        @row-click="viewTestRun"
        responsiveLayout="scroll"
        :rowHover="true"
      >
        <Column field="name" header="Name" sortable>
          <template #body="{ data }">
            <div class="test-run-name">
              <span class="name">{{ data.name }}</span>
            </div>
          </template>
        </Column>
        <Column field="status" header="Status" sortable style="width: 120px">
          <template #body="{ data }">
            <Tag
              :value="RUN_STATUS_LABELS[data.status as keyof typeof RUN_STATUS_LABELS] || data.status"
              :severity="getStatusSeverity(data.status)"
            />
          </template>
        </Column>
        <Column header="Progress" style="width: 200px">
          <template #body="{ data }">
            <div class="progress-cell" v-if="data.progress">
              <div class="pass-rate-bar">
                <div
                  class="pass-rate-bar-fill"
                  :style="{ width: calculatePassRate(data.progress) + '%' }"
                ></div>
              </div>
              <div class="progress-stats">
                <span class="pass-rate">
                  {{ calculatePassRate(data.progress) }}%
                </span>
                <span class="test-counts">
                  {{ data.progress.passed }}/{{ data.progress.total }}
                </span>
              </div>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>
        <Column header="Environment" style="width: 140px">
          <template #body="{ data }">
            <span v-if="data.config?.environment" class="environment-tag">
              {{ data.config.environment }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>
        <Column
          field="created_at"
          header="Created"
          sortable
          style="width: 120px"
        >
          <template #body="{ data }">
            {{ new Date(data.created_at).toLocaleDateString() }}
          </template>
        </Column>
        <Column
          v-if="authStore.canManageTests"
          header="Actions"
          style="width: 80px"
        >
          <template #body="{ data }">
            <Button
              icon="pi pi-ellipsis-v"
              text
              rounded
              :loading="loadingEditCases"
              @click.stop="toggleRowMenu($event, data)"
              v-tooltip.left="'Actions'"
              aria-label="Row actions"
              aria-haspopup="true"
              data-testid="row-actions-btn"
            />
          </template>
        </Column>
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-play-circle"></i>
            <p>No test runs found</p>
            <Button
              v-if="authStore.canManageTests"
              label="Create Test Run"
              icon="pi pi-plus"
              @click="router.push('/test-runs/create')"
            />
          </div>
        </template>
      </DataTable>

      <Menu ref="rowMenu" :model="rowMenuItems" popup />

      <EditTestRunDialog
        v-model:visible="showEditRunDialog"
        :test-run="editRunTarget"
      />

      <EditRunCasesDialog
        v-if="editCasesTarget"
        v-model:visible="showEditCasesDialog"
        :run-id="editCasesTarget.id"
        :project-id="editCasesTarget.project_id"
        :initial-selected-ids="editCasesInitialIds"
      />
    </div>
  </DefaultLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.test-run-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.test-run-name .name {
  font-weight: 500;
  color: var(--text-primary);
}

.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.pass-rate {
  font-weight: 600;
  color: var(--status-passed);
}

.test-counts {
  color: var(--text-secondary);
}

.pass-rate-bar {
  position: relative;
  height: 8px;
  background-color: var(--surface-border);
  border-radius: 4px;
  overflow: hidden;
}

.pass-rate-bar-fill {
  height: 100%;
  background-color: var(--success-color);
  transition: width 0.3s ease;
}

.environment-tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.text-muted {
  color: var(--text-muted);
}

:global(.p-menu .row-menu-danger .p-menuitem-link),
:global(.p-menu .row-menu-danger .p-menuitem-icon),
:global(.p-menu .row-menu-danger .p-menuitem-text) {
  color: var(--red-500, #ef4444);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin-bottom: 16px;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .header-title {
    flex-wrap: wrap;
    gap: 8px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .page-header :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .progress-cell {
    min-width: 80px;
  }

  /* Hide environment column on mobile */
  :deep(.p-datatable-thead > tr > th:nth-child(4)),
  :deep(.p-datatable-tbody > tr > td:nth-child(4)) {
    display: none;
  }
}

@media (max-width: 480px) {
  .progress-stats {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  /* Also hide created date on very small screens */
  :deep(.p-datatable-thead > tr > th:nth-child(5)),
  :deep(.p-datatable-tbody > tr > td:nth-child(5)) {
    display: none;
  }
}
</style>
