<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import { useToast } from "primevue/usetoast";
import { useTestRunsStore } from "@/stores/testRuns";
import type { TestRun, TestRunUpdate, TestRunConfig } from "@/types/testRun";

const props = defineProps<{
  visible: boolean;
  testRun: TestRun | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "saved", run: TestRun): void;
}>();

const testRunsStore = useTestRunsStore();
const toast = useToast();

interface FormState {
  name: string;
  environment: string;
  browser: string;
  build_number: string;
}

const form = ref<FormState>({
  name: "",
  environment: "",
  browser: "",
  build_number: "",
});

const original = ref<FormState>({
  name: "",
  environment: "",
  browser: "",
  build_number: "",
});

const saving = ref(false);

const environmentPresets = [
  { label: "Development", value: "Development" },
  { label: "QA", value: "QA" },
  { label: "Staging", value: "Staging" },
  { label: "UAT", value: "UAT" },
  { label: "Production", value: "Production" },
];

const browserPresets = [
  { label: "Chrome", value: "Chrome" },
  { label: "Firefox", value: "Firefox" },
  { label: "Safari", value: "Safari" },
  { label: "Edge", value: "Edge" },
  { label: "Multiple Browsers", value: "Chrome, Firefox, Safari" },
];

function toFormState(run: TestRun | null): FormState {
  return {
    name: run?.name ?? "",
    environment: run?.config?.environment ?? "",
    browser: run?.config?.browser ?? "",
    build_number: run?.config?.build_number ?? "",
  };
}

watch(
  () => [props.visible, props.testRun] as const,
  ([isVisible, run]) => {
    if (isVisible && run) {
      const state = toFormState(run);
      form.value = { ...state };
      original.value = { ...state };
    }
  },
  { immediate: true },
);

const nameValid = computed(() => form.value.name.trim().length > 0);

const patch = computed<TestRunUpdate>(() => {
  const p: TestRunUpdate = {};
  const f = form.value;
  const o = original.value;

  if (f.name.trim() !== o.name) {
    p.name = f.name.trim();
  }

  const configPatch: TestRunConfig = {};
  let configChanged = false;
  const keys: (keyof FormState & keyof TestRunConfig)[] = [
    "environment",
    "browser",
    "build_number",
  ];
  for (const key of keys) {
    if (f[key] !== o[key]) {
      configPatch[key] = f[key] || undefined;
      configChanged = true;
    }
  }
  if (configChanged) {
    p.config = configPatch;
  }
  return p;
});

const hasChanges = computed(() => Object.keys(patch.value).length > 0);
const canSubmit = computed(
  () => nameValid.value && hasChanges.value && !saving.value,
);

function close() {
  emit("update:visible", false);
}

async function handleSave() {
  if (!props.testRun || !canSubmit.value) return;
  saving.value = true;
  try {
    const updated = await testRunsStore.updateTestRun(
      props.testRun.id,
      patch.value,
    );
    toast.add({
      severity: "success",
      summary: "Updated",
      detail: "Test run updated",
      life: 3000,
    });
    emit("saved", updated);
    close();
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to update test run",
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Edit Test Run"
    :modal="true"
    :style="{ width: '480px' }"
    :closable="!saving"
  >
    <div class="dialog-content">
      <div class="field">
        <label for="edit-run-name">Name *</label>
        <InputText
          id="edit-run-name"
          data-testid="edit-run-name"
          v-model="form.name"
          class="w-full"
          :invalid="!nameValid"
        />
      </div>

      <div class="field">
        <label for="edit-run-environment">Environment</label>
        <Select
          id="edit-run-environment"
          data-testid="edit-run-environment"
          v-model="form.environment"
          :options="environmentPresets"
          optionLabel="label"
          optionValue="value"
          placeholder="Select environment"
          class="w-full"
          editable
          showClear
        />
      </div>

      <div class="field">
        <label for="edit-run-browser">Browser</label>
        <Select
          id="edit-run-browser"
          data-testid="edit-run-browser"
          v-model="form.browser"
          :options="browserPresets"
          optionLabel="label"
          optionValue="value"
          placeholder="Select browser"
          class="w-full"
          editable
          showClear
        />
      </div>

      <div class="field">
        <label for="edit-run-build">Build Number</label>
        <InputText
          id="edit-run-build"
          data-testid="edit-run-build"
          v-model="form.build_number"
          placeholder="e.g., v2.3.1"
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        text
        :disabled="saving"
        @click="close"
        data-testid="edit-run-cancel"
      />
      <Button
        label="Save"
        icon="pi pi-check"
        :loading="saving"
        :disabled="!canSubmit"
        @click="handleSave"
        data-testid="edit-run-save"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
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

.w-full {
  width: 100%;
}
</style>
