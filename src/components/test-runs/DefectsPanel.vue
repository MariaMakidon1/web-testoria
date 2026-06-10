<script setup lang="ts">
import { ref } from "vue";
import type { Defect } from "@/types/testResult";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import DataTable from "primevue/datatable";
import Column from "primevue/column";

defineProps<{
  defects: Defect[];
}>();

const emit = defineEmits<{
  (e: "add-defect", defect: Defect): void;
  (e: "remove-defect", key: string): void;
}>();

const showAddDialog = ref(false);
const newDefect = ref<Defect>({
  tracker: "jira",
  key: "",
  url: "",
  summary: "",
});
const submitted = ref(false);

const trackerOptions = [
  { label: "Jira", value: "jira" },
  { label: "GitHub", value: "github" },
  { label: "GitLab", value: "gitlab" },
  { label: "Custom", value: "custom" },
];

const trackerIcons: Record<string, string> = {
  jira: "pi pi-external-link",
  github: "pi pi-github",
  gitlab: "pi pi-gitlab",
  custom: "pi pi-link",
};

const trackerColors: Record<string, string> = {
  jira: "#0052CC",
  github: "#24292f",
  gitlab: "#FC6D26",
  custom: "#6b7280",
};

function openAddDialog() {
  newDefect.value = {
    tracker: "jira",
    key: "",
    url: "",
    summary: "",
  };
  submitted.value = false;
  showAddDialog.value = true;
}

function handleAddDefect() {
  submitted.value = true;
  if (!newDefect.value.tracker || !newDefect.value.key) return;
  emit("add-defect", { ...newDefect.value });
  showAddDialog.value = false;
}

function handleRemoveDefect(key: string) {
  emit("remove-defect", key);
}

function getTrackerUrl(defect: Defect): string {
  if (defect.url) return defect.url;

  // Generate default URLs based on tracker type
  switch (defect.tracker) {
    case "jira":
      return `https://jira.example.com/browse/${defect.key}`;
    case "github":
      return `https://github.com/issues/${defect.key}`;
    case "gitlab":
      return `https://gitlab.com/issues/${defect.key}`;
    default:
      return "#";
  }
}
</script>

<template>
  <div class="defects-panel">
    <div class="panel-header">
      <h4 class="panel-title">
        <i class="pi pi-bug"></i>
        Linked Defects
        <span class="defect-count" v-if="defects.length"
          >({{ defects.length }})</span
        >
      </h4>
      <Button
        label="Link Defect"
        icon="pi pi-plus"
        size="small"
        @click="openAddDialog"
      />
    </div>

    <!-- Empty State -->
    <div v-if="defects.length === 0" class="empty-defects">
      <i class="pi pi-check-circle"></i>
      <p>No defects linked to this test result</p>
      <Button
        label="Link a Defect"
        icon="pi pi-plus"
        text
        @click="openAddDialog"
      />
    </div>

    <!-- Defects Table -->
    <DataTable
      v-else
      :value="defects"
      class="defects-table"
      stripedRows
      size="small"
    >
      <Column field="tracker" header="Tracker" style="width: 100px">
        <template #body="{ data }">
          <div class="tracker-cell">
            <i
              :class="trackerIcons[data.tracker]"
              :style="{ color: trackerColors[data.tracker] }"
            ></i>
            <span class="tracker-name">{{ data.tracker }}</span>
          </div>
        </template>
      </Column>

      <Column field="key" header="Key" style="width: 120px">
        <template #body="{ data }">
          <a
            :href="getTrackerUrl(data)"
            target="_blank"
            rel="noopener noreferrer"
            class="defect-key-link"
          >
            {{ data.key }}
            <i class="pi pi-external-link link-icon"></i>
          </a>
        </template>
      </Column>

      <Column field="summary" header="Summary">
        <template #body="{ data }">
          <span class="defect-summary">{{ data.summary || "-" }}</span>
        </template>
      </Column>

      <Column header="Actions" style="width: 80px">
        <template #body="{ data }">
          <Button
            icon="pi pi-trash"
            text
            rounded
            severity="danger"
            size="small"
            @click="handleRemoveDefect(data.key)"
            aria-label="Remove defect"
          />
        </template>
      </Column>
    </DataTable>

    <!-- Add Defect Dialog -->
    <Dialog
      v-model:visible="showAddDialog"
      header="Link Defect"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="dialog-content">
        <div class="field">
          <label for="tracker">Tracker *</label>
          <Select
            id="tracker"
            v-model="newDefect.tracker"
            :options="trackerOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            :invalid="submitted && !newDefect.tracker"
          />
          <small v-if="submitted && !newDefect.tracker" class="field-error"
            >Tracker is required</small
          >
        </div>

        <div class="field">
          <label for="key">Issue Key *</label>
          <InputText
            id="key"
            v-model="newDefect.key"
            placeholder="e.g., PROJ-123"
            class="w-full"
            :invalid="submitted && !newDefect.key"
          />
          <small v-if="submitted && !newDefect.key" class="field-error"
            >Issue key is required</small
          >
        </div>

        <div class="field">
          <label for="url">URL (optional)</label>
          <InputText
            id="url"
            v-model="newDefect.url"
            placeholder="https://..."
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="summary">Summary (optional)</label>
          <InputText
            id="summary"
            v-model="newDefect.summary"
            placeholder="Brief description"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" text @click="showAddDialog = false" />
        <Button
          label="Link Defect"
          icon="pi pi-link"
          @click="handleAddDefect"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.defects-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.panel-title i {
  color: var(--red-500, #ef4444);
}

.defect-count {
  font-weight: 400;
  color: var(--text-color-secondary);
}

.empty-defects {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background-color: var(--surface-hover);
  border: 1px dashed var(--surface-border);
  border-radius: 8px;
  text-align: center;
}

.empty-defects i {
  font-size: 2.5rem;
  color: var(--green-500, #22c55e);
  margin-bottom: 12px;
}

.empty-defects p {
  margin: 0 0 16px 0;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.defects-table {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.tracker-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tracker-name {
  font-size: 0.8rem;
  text-transform: capitalize;
}

.defect-key-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary-600, #5a6fd6);
  text-decoration: none;
  font-weight: 500;
  font-family: monospace;
}

.defect-key-link:hover {
  color: var(--primary-700, #4a5ab3);
  text-decoration: underline;
}

.link-icon {
  font-size: 0.7rem;
}

.defect-summary {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}

.field-error {
  color: var(--red-500, #ef4444);
  font-size: 0.75rem;
}

.w-full {
  width: 100%;
}
</style>
