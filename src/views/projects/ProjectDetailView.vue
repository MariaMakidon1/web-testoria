<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProjectsStore } from "@/stores/projects";
import { useTestSuitesStore } from "@/stores/testSuites";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import ConfirmDialog from "primevue/confirmdialog";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from "@/stores/auth";
import EditProjectDialog from "@/components/projects/EditProjectDialog.vue";
import type { TestSuiteCreate } from "@/types/testSuite";
import { formatPassRate } from "@/utils/passRate";

const route = useRoute();
const router = useRouter();
const projectsStore = useProjectsStore();
const testSuitesStore = useTestSuitesStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const projectId = Number(route.params.id);

const isArchived = computed(
  () => projectsStore.currentProject?.is_archived === true,
);

const showSuiteDialog = ref(false);
const showEditDialog = ref(false);
const newSuite = ref<TestSuiteCreate>({
  name: "",
  description: "",
  parent_suite_id: undefined,
});

onMounted(async () => {
  projectsStore.setSelectedProject(projectId);
  await projectsStore.fetchProject(projectId);
  await projectsStore.fetchProjectStats(projectId);
});

function goToTestCases() {
  router.push(`/projects/${projectId}/test-cases`);
}

function goToNewTestRun() {
  router.push({
    path: "/test-runs/create",
    query: { projectId: String(projectId) },
  });
}

function openEdit() {
  showEditDialog.value = true;
}

function confirmDelete() {
  const project = projectsStore.currentProject;
  if (!project) return;
  confirm.require({
    message: `Are you sure you want to delete "${project.name}"? This will also delete all suites, cases, runs, and results in this project. This action cannot be undone.`,
    header: "Delete Project",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: () => handleDelete(),
    reject: () => {},
  });
}

async function handleDelete() {
  try {
    await projectsStore.deleteProject(projectId);
    toast.add({
      severity: "success",
      summary: "Deleted",
      detail: "Project deleted successfully",
      life: 3000,
    });
    router.push("/projects");
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to delete project",
      life: 5000,
    });
  }
}

function openSuiteDialog() {
  newSuite.value = { name: "", description: "", parent_suite_id: undefined };
  showSuiteDialog.value = true;
}

async function handleCreateSuite() {
  if (!newSuite.value.name) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Suite name is required",
      life: 3000,
    });
    return;
  }

  try {
    await testSuitesStore.createTestSuite(projectId, newSuite.value);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Test suite created successfully",
      life: 3000,
    });
    showSuiteDialog.value = false;
    await projectsStore.fetchProjectStats(projectId);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to create test suite",
      life: 5000,
    });
  }
}
</script>

<template>
  <DefaultLayout>
    <ConfirmDialog />
    <div class="project-detail-view">
      <div class="page-header">
        <div>
          <Button
            icon="pi pi-arrow-left"
            text
            @click="router.push('/projects')"
            label="Back to Projects"
          />
          <h1 v-if="projectsStore.currentProject">
            {{ projectsStore.currentProject.name }}
          </h1>
        </div>
        <div class="header-actions">
          <Button
            label="Test Cases"
            icon="pi pi-file-edit"
            @click="goToTestCases"
          />
          <span
            v-if="authStore.isProjectManager"
            v-tooltip.bottom="
              isArchived
                ? 'Project is archived — new suites cannot be created'
                : undefined
            "
          >
            <Button
              label="New Test Suite"
              icon="pi pi-sitemap"
              outlined
              :disabled="isArchived"
              @click="openSuiteDialog"
            />
          </span>
          <span
            v-if="authStore.canManageTests"
            v-tooltip.bottom="
              isArchived
                ? 'Project is archived — new test runs cannot be created'
                : undefined
            "
          >
            <Button
              label="New Test Run"
              icon="pi pi-play"
              :disabled="isArchived"
              @click="goToNewTestRun"
            />
          </span>
          <Button
            v-if="authStore.isProjectManager"
            data-testid="project-detail-edit-btn"
            label="Edit"
            icon="pi pi-pencil"
            outlined
            @click="openEdit"
          />
          <Button
            v-if="authStore.isAdmin"
            data-testid="project-detail-delete-btn"
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="confirmDelete"
          />
        </div>
      </div>

      <div v-if="projectsStore.currentProject" class="project-content">
        <div class="stats-grid">
          <Card>
            <template #content>
              <div class="stat">
                <span class="stat-value">{{
                  projectsStore.projectStats?.total_test_cases || 0
                }}</span>
                <span class="stat-label">Test Cases</span>
              </div>
            </template>
          </Card>
          <Card>
            <template #content>
              <div class="stat">
                <span class="stat-value">{{
                  projectsStore.projectStats?.total_test_runs || 0
                }}</span>
                <span class="stat-label">Test Runs</span>
              </div>
            </template>
          </Card>
          <Card>
            <template #content>
              <div class="stat">
                <span class="stat-value">{{
                  projectsStore.projectStats?.total_test_suites || 0
                }}</span>
                <span class="stat-label">Test Suites</span>
              </div>
            </template>
          </Card>
          <Card>
            <template #content>
              <div class="stat">
                <span class="stat-value">{{
                  formatPassRate(projectsStore.projectStats?.pass_rate)
                }}</span>
                <span class="stat-label">Pass Rate</span>
              </div>
            </template>
          </Card>
        </div>

        <Card class="mt-4">
          <template #title>Project Information</template>
          <template #content>
            <div
              class="info-row"
              v-if="projectsStore.currentProject.description"
            >
              <span class="info-label">Description:</span>
              <span>{{ projectsStore.currentProject.description }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Created:</span>
              <span>{{
                new Date(
                  projectsStore.currentProject.created_at,
                ).toLocaleDateString()
              }}</span>
            </div>
          </template>
        </Card>
      </div>

      <Dialog
        v-model:visible="showSuiteDialog"
        header="Add Test Suite"
        :modal="true"
        :style="{ width: '450px' }"
      >
        <div class="dialog-content">
          <div class="field">
            <label for="suite-name">Name *</label>
            <InputText id="suite-name" v-model="newSuite.name" class="w-full" />
          </div>

          <div class="field">
            <label for="suite-description">Description</label>
            <Textarea
              id="suite-description"
              v-model="newSuite.description"
              rows="3"
              class="w-full"
            />
          </div>
        </div>

        <template #footer>
          <Button label="Cancel" text @click="showSuiteDialog = false" />
          <Button label="Create" icon="pi pi-plus" @click="handleCreateSuite" />
        </template>
      </Dialog>

      <EditProjectDialog
        v-model:visible="showEditDialog"
        :project="projectsStore.currentProject"
      />
    </div>
  </DefaultLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 8px 0 0 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-color);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.info-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.info-label {
  font-weight: 600;
  min-width: 100px;
  color: var(--text-secondary);
}

.dialog-content {
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
}

.w-full {
  width: 100%;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions :deep(.p-button) {
    flex: 1;
    justify-content: center;
    white-space: nowrap;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .info-row {
    flex-direction: column;
    gap: 4px;
  }

  .info-label {
    min-width: auto;
  }
}

@media (max-width: 480px) {
  .header-actions {
    flex-direction: column;
    gap: 8px;
  }

  .header-actions :deep(.p-button) {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .stat-value {
    font-size: 1.25rem;
  }
}
</style>
