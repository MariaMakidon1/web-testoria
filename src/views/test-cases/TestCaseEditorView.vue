<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useTestCasesStore } from "@/stores/testCases";
import { useTestSuitesStore } from "@/stores/testSuites";
import { useTagsStore } from "@/stores/tags";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import AutoComplete from "primevue/autocomplete";
import ConfirmDialog from "primevue/confirmdialog";
import RichTextEditor from "@/components/common/RichTextEditor.vue";
import TestStepsEditor from "@/components/test-cases/TestStepsEditor.vue";
import {
  PRIORITIES,
  TEST_CASE_TYPES,
  TEST_CASE_STATUSES,
  PRIORITY_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  getPrioritySeverity,
} from "@/types/testCase";
import type {
  Tag as TagType,
  TestStep,
  TestCaseUpdate,
  Priority,
  TestCaseType,
  TestCaseStatus,
} from "@/types/testCase";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const testCasesStore = useTestCasesStore();
const testSuitesStore = useTestSuitesStore();
const authStore = useAuthStore();
const tagsStore = useTagsStore();
const toast = useToast();
const confirm = useConfirm();

const testCaseId = Number(route.params.id);
const loading = ref(false);
const hasChanges = ref(false);

const form = ref({
  title: "",
  description: "",
  preconditions: "",
  priority: "medium" as Priority,
  type: "manual" as TestCaseType,
  status: "draft" as TestCaseStatus,
  steps: [] as TestStep[],
  suite_id: 0,
  selectedTags: [] as TagType[],
  automation_id: "",
});

const originalForm = ref<typeof form.value | null>(null);

// Tag autocomplete state
const tagQuery = ref("");
const tagSearching = ref(false);

const tagSuggestions = computed(() => {
  const q = tagQuery.value.trim().toLowerCase();
  if (!q) return [];
  const results = tagsStore.searchResults.filter(
    (t) => !form.value.selectedTags.some((st) => st.id === t.id),
  );
  const exactMatch = results.some((t) => t.name.toLowerCase() === q);
  if (q && !exactMatch) {
    return [...results, { id: -1, name: `Create "${tagQuery.value.trim()}"` }];
  }
  return results;
});

let tagSearchTimer: ReturnType<typeof setTimeout> | null = null;

function handleTagSearch(event: { query: string }) {
  const q = event.query.trim();
  if (tagSearchTimer) clearTimeout(tagSearchTimer);
  if (!q) {
    tagsStore.searchResults = [];
    return;
  }
  tagSearching.value = true;
  tagSearchTimer = setTimeout(async () => {
    await tagsStore.searchTags(q);
    tagSearching.value = false;
  }, 250);
}

async function handleTagSelect(tag: TagType) {
  if (tag.id === -1) {
    // Create new tag inline
    const name = tagQuery.value;
    try {
      const created = await tagsStore.createTag({ name });
      form.value.selectedTags = [...form.value.selectedTags, created];
    } catch {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Failed to create tag",
        life: 3000,
      });
    }
  } else {
    form.value.selectedTags = [...form.value.selectedTags, tag];
  }
  tagQuery.value = "";
  markChanged();
}

function removeTag(tagId: number) {
  form.value.selectedTags = form.value.selectedTags.filter(
    (t) => t.id !== tagId,
  );
  markChanged();
}

// Navigation guard — prompt before leaving with unsaved changes
onBeforeRouteLeave((_to, _from, next) => {
  if (!hasChanges.value) {
    next();
    return;
  }
  confirm.require({
    message: "You have unsaved changes. Are you sure you want to leave?",
    header: "Unsaved Changes",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Leave",
    rejectLabel: "Stay",
    accept: () => next(),
    reject: () => next(false),
  });
});

// Get suite options for dropdown
const suiteOptions = computed(() =>
  testSuitesStore.testSuites.map((s) => ({ label: s.name, value: s.id })),
);

// Get current suite name
const currentSuiteName = computed(() => {
  const suite = testSuitesStore.testSuites.find(
    (s) => s.id === form.value.suite_id,
  );
  return suite?.name || "Unknown Suite";
});

function normalizeTags(tags: unknown): TagType[] {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  if (typeof tags[0] === "string") {
    // Backend currently returns string[] — map to placeholder Tag-like objects.
    // Real IDs are resolved later via tagsStore name match.
    return (tags as string[]).map((name, i) => ({ id: -(i + 1), name }));
  }
  return (tags as TagType[]).map((t) => ({ ...t }));
}

onMounted(async () => {
  await testCasesStore.fetchTestCase(testCaseId);
  const tc = testCasesStore.currentTestCase;
  if (!tc) return;

  // Populate the form immediately so fields render even if the secondary
  // suite/tag fetches fail.
  form.value = {
    title: tc.title,
    description: tc.description || "",
    preconditions: tc.preconditions || "",
    priority: tc.priority,
    type: tc.type,
    status: tc.status || "active",
    steps: tc.steps.map((s) => ({ ...s })),
    suite_id: tc.suite_id,
    selectedTags: normalizeTags(tc.tags),
    automation_id: tc.automation_id ?? "",
  };
  originalForm.value = JSON.parse(JSON.stringify(form.value));

  try {
    await testSuitesStore.fetchTestSuite(tc.suite_id);
    if (testSuitesStore.currentSuite) {
      const projectId = testSuitesStore.currentSuite.project_id;
      await Promise.all([
        testSuitesStore.fetchTestSuites(projectId),
        tagsStore.fetchTags(),
      ]);
    }

    // Resolve placeholder tag IDs against the fetched tag library.
    if (form.value.selectedTags.some((t) => t.id < 0)) {
      form.value.selectedTags = form.value.selectedTags.map((t) => {
        if (t.id < 0) {
          const real = tagsStore.tags.find((rt) => rt.name === t.name);
          return real ? { ...real } : t;
        }
        return t;
      });
      originalForm.value = JSON.parse(JSON.stringify(form.value));
    }
  } catch {
    toast.add({
      severity: "warn",
      summary: "Warning",
      detail: "Could not load suites or tags. Some dropdowns may be empty.",
      life: 5000,
    });
  }
});

function markChanged() {
  hasChanges.value =
    JSON.stringify(form.value) !== JSON.stringify(originalForm.value);
}

async function handleSave() {
  if (!form.value.title) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Title is required",
      life: 3000,
    });
    return;
  }

  loading.value = true;
  try {
    const updateData: TestCaseUpdate = {
      title: form.value.title,
      description: form.value.description || undefined,
      preconditions: form.value.preconditions || undefined,
      priority: form.value.priority,
      type: form.value.type,
      status: form.value.status,
      steps: form.value.steps,
      suite_id: form.value.suite_id,
      tags: form.value.selectedTags.map((t) => t.name),
      automation_id: form.value.automation_id.trim() || null,
    };

    await testCasesStore.updateTestCase(testCaseId, updateData);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "Test case updated successfully",
      life: 3000,
    });
    hasChanges.value = false;
    router.push(`/test-cases/${testCaseId}`);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to update test case",
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
}

function handleCancel() {
  router.back();
}
</script>

<template>
  <DefaultLayout>
    <ConfirmDialog />
    <div class="test-case-editor-view">
      <div class="page-header">
        <div class="header-left">
          <Button
            icon="pi pi-arrow-left"
            text
            @click="handleCancel"
            label="Back"
          />
          <div class="header-info">
            <h1>Edit Test Case</h1>
            <div class="header-meta">
              <Tag
                :value="PRIORITY_LABELS[form.priority]"
                :severity="getPrioritySeverity(form.priority)"
              />
              <span class="suite-badge">{{ currentSuiteName }}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <Button label="Cancel" text @click="handleCancel" />
          <Button
            v-if="authStore.isProjectManager"
            label="Save Changes"
            icon="pi pi-check"
            :loading="loading"
            :disabled="!hasChanges"
            @click="handleSave"
          />
        </div>
      </div>

      <!-- Basic Info Card -->
      <Card class="mb-4">
        <template #title>Basic Information</template>
        <template #content>
          <div class="form-grid">
            <div class="field full-width">
              <label for="title">Title *</label>
              <InputText
                id="title"
                v-model="form.title"
                class="w-full"
                @input="markChanged"
              />
            </div>

            <div class="field">
              <label for="suite">Test Suite</label>
              <Select
                id="suite"
                v-model="form.suite_id"
                :options="suiteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Select suite"
                class="w-full"
                @change="markChanged"
              />
            </div>

            <div class="field">
              <label for="priority">Priority</label>
              <Select
                id="priority"
                v-model="form.priority"
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
                @change="markChanged"
              />
            </div>

            <div class="field">
              <label for="type">Type</label>
              <Select
                id="type"
                v-model="form.type"
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
                @change="markChanged"
              />
            </div>

            <div class="field">
              <label for="status">Status</label>
              <Select
                id="status"
                v-model="form.status"
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
                @change="markChanged"
              />
            </div>

            <div class="field full-width">
              <label for="automation-id">Automation ID</label>
              <InputText
                id="automation-id"
                v-model="form.automation_id"
                placeholder="e.g. tests/login.spec.ts:42"
                maxlength="255"
                class="w-full"
                @input="markChanged"
              />
            </div>

            <div class="field full-width">
              <label>Tags</label>
              <div class="tags-field">
                <div class="tags-input-row">
                  <AutoComplete
                    v-model="tagQuery"
                    :suggestions="tagSuggestions"
                    optionLabel="name"
                    placeholder="Search or create tag..."
                    :forceSelection="false"
                    :loading="tagSearching"
                    @complete="handleTagSearch"
                    @item-select="
                      (e: { value: TagType }) => handleTagSelect(e.value)
                    "
                    class="tag-autocomplete"
                  />
                </div>
                <div v-if="form.selectedTags.length" class="tags-selected">
                  <Tag
                    v-for="tag in form.selectedTags"
                    :key="tag.id"
                    :value="tag.name"
                    class="tag-chip"
                  >
                    <template #default>
                      <span>{{ tag.name }}</span>
                      <i
                        class="pi pi-times tag-remove"
                        @click.stop="removeTag(tag.id)"
                      />
                    </template>
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Description Card -->
      <Card class="mb-4">
        <template #title>Description</template>
        <template #subtitle
          >Detailed description of what this test case covers</template
        >
        <template #content>
          <RichTextEditor
            v-model="form.description"
            placeholder="Enter test case description..."
            minHeight="120px"
            @update:modelValue="markChanged"
          />
        </template>
      </Card>

      <!-- Preconditions Card -->
      <Card class="mb-4">
        <template #title>Preconditions</template>
        <template #subtitle
          >Requirements that must be met before executing this test</template
        >
        <template #content>
          <RichTextEditor
            v-model="form.preconditions"
            placeholder="Enter preconditions..."
            minHeight="100px"
            @update:modelValue="markChanged"
          />
        </template>
      </Card>

      <!-- Test Steps Card -->
      <Card>
        <template #title>
          <div class="steps-header">
            <span>Test Steps</span>
            <span class="steps-count">{{ form.steps.length }} steps</span>
          </div>
        </template>
        <template #subtitle
          >Define the steps to execute and expected results</template
        >
        <template #content>
          <TestStepsEditor
            v-model="form.steps"
            @update:modelValue="markChanged"
          />
        </template>
      </Card>

      <div v-if="authStore.isProjectManager" class="bottom-actions">
        <Button label="Cancel" text @click="handleCancel" />
        <Button
          label="Save Changes"
          icon="pi pi-check"
          :loading="loading"
          :disabled="!hasChanges"
          @click="handleSave"
        />
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-info h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.suite-badge {
  font-size: 13px;
  color: var(--text-color-secondary);
  background: var(--surface-100);
  padding: 4px 10px;
  border-radius: 4px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.bottom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.mb-4 {
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.full-width {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
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

.steps-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.steps-count {
  font-size: 13px;
  font-weight: normal;
  color: var(--text-color-secondary);
  background: var(--surface-100);
  padding: 2px 8px;
  border-radius: 12px;
}

.tags-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-remove {
  cursor: pointer;
  font-size: 0.65rem;
  opacity: 0.7;
}

.tag-remove:hover {
  opacity: 1;
}

.tags-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tag-autocomplete {
  flex: 1;
}
</style>
