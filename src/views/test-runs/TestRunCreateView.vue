<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProjectsStore } from "@/stores/projects";
import { useTestSuitesStore } from "@/stores/testSuites";
import { useTestCasesStore } from "@/stores/testCases";
import { useTestRunsStore } from "@/stores/testRuns";
import { useToast } from "primevue/usetoast";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Stepper from "primevue/stepper";
import StepList from "primevue/steplist";
import Step from "primevue/step";
import StepPanels from "primevue/steppanels";
import StepPanel from "primevue/steppanel";
import Tag from "primevue/tag";
import TestSuiteTreeSelector from "@/components/test-cases/TestSuiteTreeSelector.vue";
import type { TestRunCreate, TestRunConfig } from "@/types/testRun";
import { getPrioritySeverity, PRIORITY_LABELS } from "@/types/testCase";

const route = useRoute();
const router = useRouter();
const projectsStore = useProjectsStore();
const testSuitesStore = useTestSuitesStore();
const testCasesStore = useTestCasesStore();
const testRunsStore = useTestRunsStore();
const toast = useToast();

const projectId = ref<number | null>(
  route.query.projectId
    ? Number(route.query.projectId)
    : projectsStore.selectedProjectId,
);
const loading = ref(false);
const activeStep = ref<number>(1);

// Form data
const form = ref<TestRunCreate>({
  name: "",
  suite_id: undefined,
  config: {
    environment: "",
    browser: "",
    build_number: "",
  },
  include_test_cases: [],
});

// Test case selection
const selectedCaseIds = ref<Set<number>>(new Set());
const selectedSuiteIds = ref<Set<number>>(new Set());
const loadingSuiteIds = ref<Set<number>>(new Set());

// Back-button target — derived from entry context (project overview vs runs list)
const backTarget = computed(() => {
  const fromProjectId = route.query.projectId;
  if (fromProjectId) {
    return {
      label: "Back to Project Overview",
      to: `/projects/${fromProjectId}`,
    };
  }
  return { label: "Back to Test Runs", to: "/test-runs" };
});

// Project options
const projectOptions = computed(() =>
  projectsStore.projects
    .filter((p) => !p.is_archived)
    .map((p) => ({ label: p.name, value: p.id })),
);

// Environment presets
const environmentPresets = [
  { label: "Development", value: "Development" },
  { label: "QA", value: "QA" },
  { label: "Staging", value: "Staging" },
  { label: "UAT", value: "UAT" },
  { label: "Production", value: "Production" },
];

// Browser presets
const browserPresets = [
  { label: "Chrome", value: "Chrome" },
  { label: "Firefox", value: "Firefox" },
  { label: "Safari", value: "Safari" },
  { label: "Edge", value: "Edge" },
  { label: "Multiple Browsers", value: "Chrome, Firefox, Safari" },
];

// Get current project name
const currentProjectName = computed(() => {
  if (!projectId.value) return "";
  const project = projectsStore.projects.find((p) => p.id === projectId.value);
  return project?.name || "";
});

// Resolved selected test cases for the review step
const selectedTestCasesList = computed(() => {
  const allCases = Object.values(testCasesStore.casesBySuite).flat();
  return allCases.filter((tc) => selectedCaseIds.value.has(tc.id));
});

// Selection summary
const selectionSummaryText = computed(() => {
  const count = selectedCaseIds.value.size;
  const suiteIds = new Set<number>();
  for (const [sid, cases] of Object.entries(testCasesStore.casesBySuite)) {
    if (cases.some((tc) => selectedCaseIds.value.has(tc.id))) {
      suiteIds.add(Number(sid));
    }
  }
  return `${count} test case${count !== 1 ? "s" : ""} selected across ${suiteIds.size} suite${suiteIds.size !== 1 ? "s" : ""}`;
});

// TES-76: block forward progress when the project itself is empty. The
// intentional empty-run path (plan-069, user has cases but selects none)
// stays untouched — this predicate keys on project-wide case availability,
// not on selection.
const projectHasNoCases = computed(
  () => Object.values(testCasesStore.casesBySuite).flat().length === 0,
);
const emptyMessageText = computed(() =>
  testSuitesStore.testSuites.length === 0
    ? "No test suites available. Create test suites and test cases first."
    : "No test cases available. Add test cases to this project before creating a run.",
);

// Watch project change to load suites
watch(projectId, async (newProjectId) => {
  if (newProjectId) {
    testCasesStore.clearCasesBySuite();
    await testSuitesStore.fetchTestSuites(newProjectId);
    selectedCaseIds.value = new Set();
    selectedSuiteIds.value = new Set();
    form.value.suite_id = undefined;
    await loadCasesForAllSuites(newProjectId);
  }
});

async function loadCasesForAllSuites(pid: number) {
  const suites = testSuitesStore.testSuites;
  await Promise.all(
    suites.map((s) => testCasesStore.fetchTestCasesBySuite(pid, s.id)),
  );
}

async function handleExpandSuite(suiteId: number) {
  if (!projectId.value || testCasesStore.casesBySuite[suiteId]) return;
  loadingSuiteIds.value = new Set([...loadingSuiteIds.value, suiteId]);
  await testCasesStore.fetchTestCasesBySuite(projectId.value, suiteId);
  const next = new Set(loadingSuiteIds.value);
  next.delete(suiteId);
  loadingSuiteIds.value = next;
}

onMounted(async () => {
  await projectsStore.fetchProjects();
  if (projectId.value) {
    await testSuitesStore.fetchTestSuites(projectId.value);
    await loadCasesForAllSuites(projectId.value);
  }
});

function validateStep1(): boolean {
  if (!projectId.value) {
    toast.add({
      severity: "warn",
      summary: "Validation",
      detail: "Please select a project",
      life: 3000,
    });
    return false;
  }
  if (!form.value.name?.trim()) {
    toast.add({
      severity: "warn",
      summary: "Validation",
      detail: "Please enter a test run name",
      life: 3000,
    });
    return false;
  }
  return true;
}

function nextStep() {
  if (activeStep.value === 1 && !validateStep1()) return;
  activeStep.value++;
}

function prevStep() {
  activeStep.value--;
}

function handleCancel() {
  router.push(backTarget.value.to);
}

async function handleCreate() {
  if (!projectId.value) return;

  loading.value = true;
  try {
    const createData: TestRunCreate = {
      name: form.value.name,
      suite_id: form.value.suite_id || undefined,
      config: {
        environment:
          (form.value.config as TestRunConfig)?.environment || undefined,
        browser: (form.value.config as TestRunConfig)?.browser || undefined,
        build_number:
          (form.value.config as TestRunConfig)?.build_number || undefined,
      },
      include_test_cases: [...selectedCaseIds.value],
    };

    const testRun = await testRunsStore.createTestRun(
      projectId.value,
      createData,
    );

    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Test run created successfully",
      life: 3000,
    });

    // Navigate to execution view
    router.push(`/test-runs/${testRun.id}/execute`);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to create test run",
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <DefaultLayout>
    <div class="test-run-create-view">
      <div class="page-header">
        <div>
          <Button
            icon="pi pi-arrow-left"
            text
            data-testid="create-back-btn"
            :label="backTarget.label"
            @click="router.push(backTarget.to)"
          />
          <h1>Create Test Run</h1>
        </div>
      </div>

      <Card>
        <template #content>
          <Stepper v-model:value="activeStep" linear>
            <StepList>
              <Step :value="1">Basic Information</Step>
              <Step :value="2">Select Test Cases</Step>
              <Step :value="3">Review & Create</Step>
            </StepList>

            <StepPanels>
              <!-- Step 1: Basic Info -->
              <StepPanel :value="1">
                <div class="step-content">
                  <div class="form-grid">
                    <div class="field">
                      <label for="project">Project *</label>
                      <Select
                        id="project"
                        data-testid="create-project-select"
                        v-model="projectId"
                        :options="projectOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select a project"
                        class="w-full"
                        :disabled="!!route.query.projectId"
                      />
                    </div>

                    <div class="field">
                      <label for="name">Test Run Name *</label>
                      <InputText
                        id="name"
                        data-testid="create-name-input"
                        v-model="form.name"
                        placeholder="e.g., Sprint 24 Regression"
                        class="w-full"
                      />
                    </div>

                    <div class="field">
                      <label for="environment">Environment</label>
                      <Select
                        id="environment"
                        v-model="(form.config as TestRunConfig).environment"
                        :options="environmentPresets"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select environment"
                        class="w-full"
                        editable
                      />
                    </div>

                    <div class="field">
                      <label for="browser">Browser</label>
                      <Select
                        id="browser"
                        v-model="(form.config as TestRunConfig).browser"
                        :options="browserPresets"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select browser"
                        class="w-full"
                        editable
                      />
                    </div>

                    <div class="field">
                      <label for="build">Build Number</label>
                      <InputText
                        id="build"
                        v-model="(form.config as TestRunConfig).build_number"
                        placeholder="e.g., v2.3.1"
                        class="w-full"
                      />
                    </div>
                  </div>

                  <div class="step-actions">
                    <Button
                      data-testid="create-cancel-btn"
                      label="Cancel"
                      text
                      severity="secondary"
                      @click="handleCancel"
                    />
                    <Button
                      data-testid="create-next-btn"
                      label="Next"
                      icon="pi pi-arrow-right"
                      iconPos="right"
                      @click="nextStep"
                    />
                  </div>
                </div>
              </StepPanel>

              <!-- Step 2: Select Test Cases -->
              <StepPanel :value="2">
                <div class="step-content">
                  <div class="selection-summary">
                    <Tag severity="info" :value="selectionSummaryText" />
                  </div>

                  <div class="tree-selector-container">
                    <TestSuiteTreeSelector
                      :suites="testSuitesStore.suiteTree"
                      :casesBySuite="testCasesStore.casesBySuite"
                      :selectedCaseIds="selectedCaseIds"
                      :selectedSuiteIds="selectedSuiteIds"
                      :loadingSuiteIds="loadingSuiteIds"
                      @update:selectedCaseIds="selectedCaseIds = $event"
                      @update:selectedSuiteIds="selectedSuiteIds = $event"
                      @expand-suite="handleExpandSuite"
                    />
                    <div
                      v-if="projectHasNoCases"
                      class="empty-message"
                      data-testid="create-empty-message"
                    >
                      <p>{{ emptyMessageText }}</p>
                    </div>
                  </div>

                  <div class="step-actions">
                    <Button
                      data-testid="create-cancel-btn"
                      label="Cancel"
                      text
                      severity="secondary"
                      @click="handleCancel"
                    />
                    <Button
                      label="Back"
                      icon="pi pi-arrow-left"
                      text
                      @click="prevStep"
                    />
                    <Button
                      v-if="selectedCaseIds.size === 0"
                      label="Skip — create without cases"
                      text
                      data-testid="create-skip-cases-btn"
                      :disabled="projectHasNoCases"
                      @click="nextStep"
                    />
                    <Button
                      data-testid="create-next-btn"
                      :label="
                        selectedCaseIds.size === 0
                          ? 'Next with 0 cases'
                          : 'Next'
                      "
                      icon="pi pi-arrow-right"
                      iconPos="right"
                      :disabled="projectHasNoCases"
                      @click="nextStep"
                    />
                  </div>
                </div>
              </StepPanel>

              <!-- Step 3: Review & Create -->
              <StepPanel :value="3">
                <div class="step-content">
                  <div class="review-section">
                    <h3>Test Run Summary</h3>
                    <div class="review-grid">
                      <div class="review-item">
                        <span class="review-label">Project</span>
                        <span class="review-value">{{
                          currentProjectName
                        }}</span>
                      </div>
                      <div class="review-item">
                        <span class="review-label">Name</span>
                        <span class="review-value">{{ form.name }}</span>
                      </div>
                      <div class="review-item">
                        <span class="review-label">Environment</span>
                        <span class="review-value">{{
                          (form.config as TestRunConfig)?.environment || "-"
                        }}</span>
                      </div>
                      <div class="review-item">
                        <span class="review-label">Browser</span>
                        <span class="review-value">{{
                          (form.config as TestRunConfig)?.browser || "-"
                        }}</span>
                      </div>
                      <div class="review-item">
                        <span class="review-label">Build Number</span>
                        <span class="review-value">{{
                          (form.config as TestRunConfig)?.build_number || "-"
                        }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="review-section">
                    <h3>Selected Test Cases ({{ selectedCaseIds.size }})</h3>
                    <div
                      v-if="selectedCaseIds.size === 0"
                      class="empty-cases-hint"
                    >
                      No cases selected — you can add them from the run detail
                      page after creation.
                    </div>
                    <div v-else class="selected-cases-list">
                      <div
                        v-for="tc in selectedTestCasesList.slice(0, 10)"
                        :key="tc.id"
                        class="selected-case-item"
                      >
                        <Tag
                          :value="
                            PRIORITY_LABELS[
                              tc.priority as keyof typeof PRIORITY_LABELS
                            ] || tc.priority
                          "
                          :severity="getPrioritySeverity(tc.priority)"
                        />
                        <span>{{ tc.title }}</span>
                      </div>
                      <div
                        v-if="selectedTestCasesList.length > 10"
                        class="more-cases"
                      >
                        ... and {{ selectedTestCasesList.length - 10 }} more
                      </div>
                    </div>
                  </div>

                  <div class="step-actions">
                    <Button
                      data-testid="create-cancel-btn"
                      label="Cancel"
                      text
                      severity="secondary"
                      @click="handleCancel"
                    />
                    <Button
                      label="Back"
                      icon="pi pi-arrow-left"
                      text
                      @click="prevStep"
                    />
                    <Button
                      data-testid="create-submit-btn"
                      label="Create Test Run"
                      icon="pi pi-play"
                      :loading="loading"
                      @click="handleCreate"
                    />
                  </div>
                </div>
              </StepPanel>
            </StepPanels>
          </Stepper>
        </template>
      </Card>
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
  font-size: 24px;
  font-weight: 600;
  margin: 8px 0 0 0;
}

.step-content {
  padding: 24px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.full-width {
  grid-column: 1 / -1;
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

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--surface-border);
}

.selection-summary {
  margin-bottom: 12px;
}

.tree-selector-container {
  max-height: 450px;
  overflow-y: auto;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 8px;
}

.empty-message {
  padding: 32px;
  text-align: center;
  color: var(--text-color-secondary);
}

.review-section {
  margin-bottom: 24px;
}

.review-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-color);
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.review-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-label {
  font-size: 12px;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.review-value {
  font-size: 14px;
  color: var(--text-color);
}

.selected-cases-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.empty-cases-hint {
  padding: 12px 14px;
  border: 1px dashed var(--surface-border);
  border-radius: 6px;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  background: var(--surface-ground);
}

.selected-case-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--surface-ground);
  border-radius: 4px;
}

.more-cases {
  padding: 8px 12px;
  color: var(--text-color-secondary);
  font-style: italic;
}

@media (max-width: 768px) {
  .form-grid,
  .review-grid {
    grid-template-columns: 1fr;
  }
}
</style>
