<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Checkbox from "primevue/checkbox";
import { useToast } from "primevue/usetoast";
import { useProjectsStore } from "@/stores/projects";
import type { Project, ProjectUpdate } from "@/types/project";

const props = defineProps<{
  visible: boolean;
  project: Project | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "saved", project: Project): void;
}>();

const projectsStore = useProjectsStore();
const toast = useToast();

interface FormState {
  name: string;
  description: string;
  is_archived: boolean;
}

const form = ref<FormState>({ name: "", description: "", is_archived: false });
const original = ref<FormState>({
  name: "",
  description: "",
  is_archived: false,
});
const saving = ref(false);

function toFormState(p: Project | null): FormState {
  return {
    name: p?.name ?? "",
    description: p?.description ?? "",
    is_archived: p?.is_archived ?? false,
  };
}

watch(
  () => [props.visible, props.project] as const,
  ([isVisible, project]) => {
    if (isVisible && project) {
      const state = toFormState(project);
      form.value = { ...state };
      original.value = { ...state };
    }
  },
  { immediate: true },
);

const nameValid = computed(() => form.value.name.trim().length > 0);

const patch = computed<ProjectUpdate>(() => {
  const p: ProjectUpdate = {};
  const f = form.value;
  const o = original.value;
  if (f.name.trim() !== o.name) p.name = f.name.trim();
  if (f.description !== o.description) p.description = f.description;
  if (f.is_archived !== o.is_archived) p.is_archived = f.is_archived;
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
  if (!props.project || !canSubmit.value) return;
  saving.value = true;
  try {
    const updated = await projectsStore.updateProject(
      props.project.id,
      patch.value,
    );
    toast.add({
      severity: "success",
      summary: "Updated",
      detail: "Project updated",
      life: 3000,
    });
    emit("saved", updated);
    close();
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to update project",
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
    header="Edit Project"
    :modal="true"
    :style="{ width: '500px' }"
    :closable="!saving"
  >
    <div class="dialog-content">
      <div class="field">
        <label for="edit-project-name">Project Name *</label>
        <InputText
          id="edit-project-name"
          data-testid="edit-project-name"
          v-model="form.name"
          class="w-full"
          :invalid="!nameValid"
        />
      </div>

      <div class="field">
        <label for="edit-project-description">Description</label>
        <Textarea
          id="edit-project-description"
          data-testid="edit-project-description"
          v-model="form.description"
          rows="3"
          class="w-full"
        />
      </div>

      <div class="field-checkbox">
        <Checkbox
          v-model="form.is_archived"
          :binary="true"
          inputId="edit-project-archived"
          data-testid="edit-project-archived"
        />
        <label for="edit-project-archived" class="ml-2"
          >Archive this project</label
        >
      </div>
    </div>

    <template #footer>
      <Button
        data-testid="edit-project-cancel"
        label="Cancel"
        text
        severity="secondary"
        :disabled="saving"
        @click="close"
      />
      <Button
        data-testid="edit-project-save"
        label="Save Changes"
        icon="pi pi-check"
        :loading="saving"
        :disabled="!canSubmit"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>

<style scoped>
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

.field-checkbox {
  display: flex;
  align-items: center;
}

.w-full {
  width: 100%;
}

.ml-2 {
  margin-left: 8px;
}
</style>
