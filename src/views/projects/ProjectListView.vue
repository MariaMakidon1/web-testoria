<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useProjectsStore } from "@/stores/projects";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Checkbox from "primevue/checkbox";
import ConfirmDialog from "primevue/confirmdialog";
import Tag from "primevue/tag";
import type { Project, ProjectCreate } from "@/types/project";
import { useAuthStore } from "@/stores/auth";
import EditProjectDialog from "@/components/projects/EditProjectDialog.vue";

const router = useRouter();
const projectsStore = useProjectsStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

// Search and filters
const searchQuery = ref("");
const showArchived = ref(false);

// Dialogs
const showCreateDialog = ref(false);
const showEditDialog = ref(false);

// Form data
const newProject = ref<ProjectCreate>({
  name: "",
  description: "",
});

const editTargetProject = ref<Project | null>(null);

// Filtered projects (search-only — archived filtering is server-side)
const filteredProjects = computed(() => {
  let projects = projectsStore.projects;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query),
    );
  }

  return projects;
});

onMounted(() => {
  projectsStore.fetchProjects({ include_archived: showArchived.value });
});

watch(showArchived, (value) => {
  projectsStore.fetchProjects({ include_archived: value });
});

function openCreateDialog() {
  newProject.value = { name: "", description: "" };
  showCreateDialog.value = true;
}

function openEditDialog(project: Project) {
  editTargetProject.value = project;
  showEditDialog.value = true;
}

async function handleCreateProject() {
  if (!newProject.value.name) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Project name is required",
      life: 3000,
    });
    return;
  }

  try {
    const project = await projectsStore.createProject(newProject.value);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Project created successfully",
      life: 3000,
    });
    showCreateDialog.value = false;
    // Update global project selection in navbar
    projectsStore.setSelectedProject(project.id);
    router.push(`/projects/${project.id}`);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to create project",
      life: 5000,
    });
  }
}

function confirmDeleteProject(project: Project) {
  confirm.require({
    message: `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
    header: "Delete Project",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: () => handleDeleteProject(project.id),
    reject: () => {},
  });
}

async function handleDeleteProject(id: number) {
  try {
    await projectsStore.deleteProject(id);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Project deleted successfully",
      life: 3000,
    });
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

function viewProject(event: { data: { id: number } }) {
  // Update global project selection in navbar
  projectsStore.setSelectedProject(event.data.id);
  router.push(`/projects/${event.data.id}`);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString();
}
</script>

<template>
  <DefaultLayout>
    <ConfirmDialog />
    <div class="project-list-view">
      <div class="page-header">
        <h1>Projects</h1>
        <Button
          v-if="authStore.isProjectManager"
          label="Create Project"
          icon="pi pi-plus"
          @click="openCreateDialog"
        />
      </div>

      <!-- Search and Filters -->
      <div class="filters-bar">
        <span class="p-input-icon-left flex-grow">
          <i class="pi pi-search" />
          <InputText
            v-model="searchQuery"
            placeholder="Search projects..."
            class="w-full"
          />
        </span>
        <div class="filter-checkbox">
          <Checkbox
            v-model="showArchived"
            :binary="true"
            inputId="showArchived"
            data-testid="show-archived-checkbox"
          />
          <label for="showArchived" class="ml-2">Show archived</label>
        </div>
      </div>

      <DataTable
        :value="filteredProjects"
        :loading="projectsStore.loading"
        stripedRows
        @row-click="viewProject"
        class="mt-4"
        responsiveLayout="scroll"
        :rowHover="true"
      >
        <Column field="name" header="Name" sortable>
          <template #body="{ data }">
            <div class="project-name">
              {{ data.name }}
              <Tag
                v-if="data.is_archived"
                value="Archived"
                severity="warning"
                class="ml-2"
              />
            </div>
          </template>
        </Column>
        <Column field="description" header="Description">
          <template #body="{ data }">
            <span class="description-text">{{ data.description || "-" }}</span>
          </template>
        </Column>
        <Column
          field="created_at"
          header="Created"
          sortable
          style="width: 120px"
        >
          <template #body="{ data }">
            {{ formatDate(data.created_at) }}
          </template>
        </Column>
        <Column
          v-if="authStore.isProjectManager"
          header="Actions"
          style="width: 120px"
        >
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                severity="secondary"
                @click.stop="openEditDialog(data)"
                v-tooltip.left="'Edit'"
              />
              <Button
                v-if="authStore.isAdmin"
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                @click.stop="confirmDeleteProject(data)"
                v-tooltip.left="'Delete'"
              />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-folder-open"></i>
            <p>No projects found</p>
            <Button
              v-if="authStore.isProjectManager"
              label="Create your first project"
              icon="pi pi-plus"
              @click="openCreateDialog"
            />
          </div>
        </template>
      </DataTable>

      <!-- Create Dialog -->
      <Dialog
        v-model:visible="showCreateDialog"
        header="Create New Project"
        :modal="true"
        :style="{ width: '500px' }"
      >
        <div class="dialog-content">
          <div class="field">
            <label for="create-name">Project Name *</label>
            <InputText
              id="create-name"
              v-model="newProject.name"
              class="w-full"
            />
          </div>

          <div class="field">
            <label for="create-description">Description</label>
            <Textarea
              id="create-description"
              v-model="newProject.description"
              rows="3"
              class="w-full"
            />
          </div>
        </div>

        <template #footer>
          <Button label="Cancel" text @click="showCreateDialog = false" />
          <Button
            label="Create"
            icon="pi pi-plus"
            @click="handleCreateProject"
          />
        </template>
      </Dialog>

      <!-- Edit Dialog (shared with ProjectDetailView via plan-091) -->
      <EditProjectDialog
        v-model:visible="showEditDialog"
        :project="editTargetProject"
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

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.filters-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.flex-grow {
  flex-grow: 1;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.ml-2 {
  margin-left: 8px;
}

.w-full {
  width: 100%;
}

.project-name {
  display: flex;
  align-items: center;
}

.description-text {
  color: var(--text-secondary);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 4px;
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
}

.empty-state p {
  margin-bottom: 16px;
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

.field small {
  color: var(--text-muted);
}

.field-checkbox {
  display: flex;
  align-items: center;
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

  .page-header :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-checkbox {
    justify-content: flex-start;
  }

  .description-text {
    max-width: 150px;
  }
}

@media (max-width: 480px) {
  .description-text {
    display: none;
  }
}
</style>
