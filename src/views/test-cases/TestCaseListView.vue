<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTestCasesStore } from "@/stores/testCases";
import { useTestSuitesStore } from "@/stores/testSuites";
import { useProjectsStore } from "@/stores/projects";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from "@/stores/auth";
import { useTagsStore } from "@/stores/tags";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import TestCaseTreeView from "@/components/test-cases/TestCaseTreeView.vue";
import TestStepsEditor from "@/components/test-cases/TestStepsEditor.vue";
import RichTextEditor from "@/components/common/RichTextEditor.vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import ConfirmDialog from "primevue/confirmdialog";
import type { TestCase, TestCaseCreate } from "@/types/testCase";
import type { TestSuite, TestSuiteCreate } from "@/types/testSuite";
import {
  PRIORITIES,
  TEST_CASE_TYPES,
  TEST_CASE_STATUSES,
  PRIORITY_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
} from "@/types/testCase";

const route = useRoute();
const router = useRouter();
const testCasesStore = useTestCasesStore();
const testSuitesStore = useTestSuitesStore();
const projectsStore = useProjectsStore();
const authStore = useAuthStore();
const tagsStore = useTagsStore();
const toast = useToast();
const confirm = useConfirm();

const autoSelectSuiteAfterCreate = ref(false);

// Use reactive projectId that updates from route or global selection
const currentProjectId = ref(Number(route.params.projectId));

// Watch for global project selection changes - navigate to that project's test cases
watch(
  () => projectsStore.selectedProjectId,
  (newProjectId) => {
    if (newProjectId && newProjectId !== currentProjectId.value) {
      router.push(`/projects/${newProjectId}/test-cases`);
    }
  },
);

// Watch for route changes to update currentProjectId
watch(
  () => route.params.projectId,
  (newId) => {
    if (newId) {
      currentProjectId.value = Number(newId);
      loadData();
    }
  },
);

// Backward compatibility alias
const projectId = computed(() => currentProjectId.value);

// Loading state
const loading = ref(true);

// Dialogs
const showCreateDialog = ref(false);
const showSuiteDialog = ref(false);
const showEditSuiteDialog = ref(false);

// Form data
const newTestCase = ref<TestCaseCreate>({
  suite_id: 0,
  title: "",
  description: "",
  preconditions: "",
  steps: [],
  priority: "medium",
  type: "manual",
  status: "draft",
});

const newSuite = ref<TestSuiteCreate>({
  name: "",
  description: "",
  parent_suite_id: undefined,
});

const editSuite = ref<{ id: number; name: string; description: string }>({
  id: 0,
  name: "",
  description: "",
});

// Computed
const suiteOptionsForForm = computed(() =>
  testSuitesStore.testSuites.map((s) => ({ label: s.name, value: s.id })),
);

const projectName = computed(() => {
  const project = projectsStore.projects.find(
    (p) => p.id === currentProjectId.value,
  );
  return project?.name || "Project";
});

// Tag filter
const selectedTagIds = ref<number[]>(
  (route.query.tag_ids
    ? Array.isArray(route.query.tag_ids)
      ? route.query.tag_ids
      : [route.query.tag_ids]
    : []
  )
    .map(Number)
    .filter((n) => !isNaN(n)),
);

const tagOptions = computed(() =>
  tagsStore.tags.map((t) => ({ label: t.name, value: t.id })),
);

watch(selectedTagIds, (ids) => {
  router.replace({
    query: {
      ...route.query,
      tag_ids: ids.length ? ids.map(String) : undefined,
    },
  });
  testCasesStore.setFilters({ tag_ids: ids.length ? ids : undefined });
  testCasesStore.fetchTestCases(currentProjectId.value);
});

// Get all test cases without pagination for tree view
const allTestCases = computed(() => testCasesStore.testCases);

// Load data function
async function loadData() {
  loading.value = true;
  try {
    if (selectedTagIds.value.length) {
      testCasesStore.setFilters({ tag_ids: selectedTagIds.value });
    }
    await Promise.all([
      testSuitesStore.fetchTestSuites(currentProjectId.value),
      projectsStore.fetchProjects(),
      testCasesStore.fetchTestCases(currentProjectId.value),
      tagsStore.fetchTags(),
    ]);
  } finally {
    loading.value = false;
  }
}

// Initial load
onMounted(() => {
  // Sync navbar project selection
  projectsStore.setSelectedProject(currentProjectId.value);
  loadData();
});

// Handle case selection - navigate to detail
function handleSelectCase(caseId: number) {
  router.push(`/test-cases/${caseId}`);
}

// Add test case dialog
function handleAddCase(suiteId: number | null) {
  const suite = suiteId
    ? testSuitesStore.testSuites.find((s) => s.id === suiteId)
    : testSuitesStore.testSuites[0];
  newTestCase.value = {
    suite_id: suite?.id || 0,
    title: "",
    description: "",
    preconditions: "",
    steps: [],
    priority: "medium",
    type: "manual",
    status: "draft",
  };
  showCreateDialog.value = true;
}

// Add suite dialog
function handleAddSuite(parentId: number | null) {
  newSuite.value = {
    name: "",
    description: "",
    parent_suite_id: parentId ?? undefined,
  };
  showSuiteDialog.value = true;
}

// Quick-create a suite from inside the create test case dialog
function handleQuickCreateSuite() {
  autoSelectSuiteAfterCreate.value = true;
  handleAddSuite(null);
}

// Edit suite dialog
function handleEditSuite(suite: TestSuite) {
  editSuite.value = {
    id: suite.id,
    name: suite.name,
    description: suite.description || "",
  };
  showEditSuiteDialog.value = true;
}

// Delete test case
async function handleReorderSuite(id: number, newDisplayOrder: number) {
  try {
    await testSuitesStore.reorderTestSuite(id, newDisplayOrder);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to reorder section",
      life: 5000,
    });
  }
}

async function handleReorderCase(
  id: number,
  suiteId: number,
  newDisplayOrder: number,
) {
  try {
    await testCasesStore.reorderTestCase(id, suiteId, newDisplayOrder);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to reorder test case",
      life: 5000,
    });
  }
}

function handleDeleteCase(testCase: TestCase) {
  confirm.require({
    message: `Are you sure you want to delete "${testCase.title}"? This action cannot be undone.`,
    header: "Delete Test Case",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: async () => {
      try {
        await testCasesStore.deleteTestCase(testCase.id);
        toast.add({
          severity: "success",
          summary: "Deleted",
          detail: "Test case deleted successfully",
          life: 3000,
        });
      } catch (error) {
        const err = error as { response?: { data?: { detail?: string } } };
        toast.add({
          severity: "error",
          summary: "Error",
          detail: err.response?.data?.detail || "Failed to delete test case",
          life: 5000,
        });
      }
    },
    reject: () => {},
  });
}

// Delete test suite
function handleDeleteSuite(suite: TestSuite) {
  confirm.require({
    message: `Are you sure you want to delete "${suite.name}"? This will also delete all test cases in this suite and its child suites. This action cannot be undone.`,
    header: "Delete Section",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: async () => {
      try {
        await testSuitesStore.deleteTestSuite(suite.id);
        await testCasesStore.fetchTestCases(currentProjectId.value);
        toast.add({
          severity: "success",
          summary: "Deleted",
          detail: "Section deleted successfully",
          life: 3000,
        });
      } catch (error) {
        const err = error as { response?: { data?: { detail?: string } } };
        toast.add({
          severity: "error",
          summary: "Error",
          detail: err.response?.data?.detail || "Failed to delete section",
          life: 5000,
        });
      }
    },
    reject: () => {},
  });
}

// Create test case
async function handleCreateTestCase() {
  if (!newTestCase.value.title || !newTestCase.value.suite_id) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Please fill in all required fields",
      life: 3000,
    });
    return;
  }

  try {
    const created = await testCasesStore.createTestCase(
      currentProjectId.value,
      newTestCase.value,
    );
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Test case created successfully",
      life: 3000,
    });
    showCreateDialog.value = false;
    router.push(`/test-cases/${created.id}`);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to create test case",
      life: 5000,
    });
  }
}

// Create suite
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
    const created = await testSuitesStore.createTestSuite(
      currentProjectId.value,
      newSuite.value,
    );
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Section created successfully",
      life: 3000,
    });
    showSuiteDialog.value = false;
    if (autoSelectSuiteAfterCreate.value) {
      newTestCase.value.suite_id = created.id;
      autoSelectSuiteAfterCreate.value = false;
    }
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to create section",
      life: 5000,
    });
  }
}

// Update suite
async function handleUpdateSuite() {
  if (!editSuite.value.name) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Suite name is required",
      life: 3000,
    });
    return;
  }

  try {
    await testSuitesStore.updateTestSuite(editSuite.value.id, {
      name: editSuite.value.name,
      description: editSuite.value.description,
    });
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Section updated successfully",
      life: 3000,
    });
    showEditSuiteDialog.value = false;
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to update section",
      life: 5000,
    });
  }
}
</script>

<template>
  <DefaultLayout :fullHeight="true">
    <ConfirmDialog />
    <div class="test-case-list-view">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <Button
            icon="pi pi-arrow-left"
            text
            @click="router.push(`/projects/${projectId}`)"
            aria-label="Back to Project"
          />
          <h1>{{ projectName }}</h1>
        </div>
        <div class="header-right">
          <MultiSelect
            v-model="selectedTagIds"
            :options="tagOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Filter by tags"
            display="chip"
            :filter="true"
            class="tag-filter"
          />
        </div>
      </div>

      <!-- Tree View -->
      <div class="tree-view-container">
        <TestCaseTreeView
          :suiteTree="testSuitesStore.suiteTree"
          :testCases="allTestCases"
          :loading="loading"
          @select-case="handleSelectCase"
          @add-case="handleAddCase"
          @add-suite="handleAddSuite"
          @edit-suite="handleEditSuite"
          @delete-suite="handleDeleteSuite"
          @delete-case="handleDeleteCase"
          @reorder-suite="handleReorderSuite"
          @reorder-case="handleReorderCase"
        />
      </div>

      <!-- Create Test Case Dialog -->
      <Dialog
        v-model:visible="showCreateDialog"
        header="Create New Test Case"
        :modal="true"
        :style="{ width: '50rem' }"
        :contentStyle="{ maxHeight: '70vh', overflowY: 'auto' }"
      >
        <div class="dialog-content">
          <div class="field">
            <label for="create-title">Title *</label>
            <InputText
              id="create-title"
              v-model="newTestCase.title"
              class="w-full"
            />
          </div>

          <div class="field">
            <label for="create-suite">Test Suite *</label>
            <div class="suite-select-row">
              <Select
                id="create-suite"
                v-model="newTestCase.suite_id"
                :options="suiteOptionsForForm"
                optionLabel="label"
                optionValue="value"
                placeholder="Select a suite"
                class="flex-1"
              />
              <Button
                v-if="authStore.isProjectManager"
                icon="pi pi-plus"
                outlined
                aria-label="New Suite"
                v-tooltip.top="'New Suite'"
                @click="handleQuickCreateSuite"
              />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="create-priority">Priority</label>
              <Select
                id="create-priority"
                v-model="newTestCase.priority"
                :options="
                  PRIORITIES.map((p) => ({
                    label: PRIORITY_LABELS[p],
                    value: p,
                  }))
                "
                optionLabel="label"
                optionValue="value"
                placeholder="Select priority"
                class="w-full"
              />
            </div>
            <div class="field">
              <label for="create-type">Type</label>
              <Select
                id="create-type"
                v-model="newTestCase.type"
                :options="
                  TEST_CASE_TYPES.map((t) => ({
                    label: TYPE_LABELS[t],
                    value: t,
                  }))
                "
                optionLabel="label"
                optionValue="value"
                placeholder="Select type"
                class="w-full"
              />
            </div>
            <div class="field">
              <label for="create-status">Status</label>
              <Select
                id="create-status"
                v-model="newTestCase.status"
                :options="
                  TEST_CASE_STATUSES.map((s) => ({
                    label: STATUS_LABELS[s],
                    value: s,
                  }))
                "
                optionLabel="label"
                optionValue="value"
                placeholder="Select status"
                class="w-full"
              />
            </div>
          </div>

          <div class="field">
            <label>Description</label>
            <RichTextEditor
              v-model="newTestCase.description"
              placeholder="Enter test case description..."
              minHeight="100px"
            />
          </div>

          <div class="field">
            <label>Preconditions</label>
            <RichTextEditor
              v-model="newTestCase.preconditions"
              placeholder="Enter preconditions..."
              minHeight="80px"
            />
          </div>

          <div class="field">
            <label>Test Steps</label>
            <TestStepsEditor v-model="newTestCase.steps" />
          </div>
        </div>

        <template #footer>
          <Button label="Cancel" text @click="showCreateDialog = false" />
          <Button
            label="Create"
            icon="pi pi-plus"
            @click="handleCreateTestCase"
          />
        </template>
      </Dialog>

      <!-- Create Section Dialog -->
      <Dialog
        v-model:visible="showSuiteDialog"
        header="Add Section"
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
          <Button
            label="Add Section"
            icon="pi pi-plus"
            @click="handleCreateSuite"
          />
        </template>
      </Dialog>

      <!-- Edit Section Dialog -->
      <Dialog
        v-model:visible="showEditSuiteDialog"
        header="Edit Section"
        :modal="true"
        :style="{ width: '450px' }"
      >
        <div class="dialog-content">
          <div class="field">
            <label for="edit-suite-name">Name *</label>
            <InputText
              id="edit-suite-name"
              v-model="editSuite.name"
              class="w-full"
            />
          </div>

          <div class="field">
            <label for="edit-suite-description">Description</label>
            <Textarea
              id="edit-suite-description"
              v-model="editSuite.description"
              rows="3"
              class="w-full"
            />
          </div>
        </div>

        <template #footer>
          <Button label="Cancel" text @click="showEditSuiteDialog = false" />
          <Button
            label="Save Changes"
            icon="pi pi-check"
            @click="handleUpdateSuite"
          />
        </template>
      </Dialog>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.test-case-list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-filter {
  min-width: 220px;
  max-width: 400px;
}

.page-header h1 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.tree-view-container {
  flex: 1;
  min-height: 0;
}

.w-full {
  width: 100%;
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

.field-row {
  display: flex;
  gap: 16px;
}

.field-row .field {
  flex: 1;
}

.suite-select-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.suite-select-row .flex-1 {
  flex: 1;
  min-width: 0;
}
</style>
