<script setup lang="ts">
import { ref, computed } from "vue";
import Button from "primevue/button";
import RichTextEditor from "@/components/common/RichTextEditor.vue";
import type { TestStep } from "@/types/testCase";

const props = defineProps<{
  modelValue: TestStep[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: TestStep[]): void;
}>();

const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

const steps = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

function addStep() {
  emit("update:modelValue", [...props.modelValue, { step: "", expected: "" }]);
}

function removeStep(index: number) {
  const newSteps = [...props.modelValue];
  newSteps.splice(index, 1);
  emit("update:modelValue", newSteps);
}

function updateStep(index: number, field: "step" | "expected", value: string) {
  const newSteps = [...props.modelValue];
  newSteps[index] = { ...newSteps[index], [field]: value };
  emit("update:modelValue", newSteps);
}

function duplicateStep(index: number) {
  const newSteps = [...props.modelValue];
  const duplicate = { ...newSteps[index] };
  newSteps.splice(index + 1, 0, duplicate);
  emit("update:modelValue", newSteps);
}

function moveStepUp(index: number) {
  if (index === 0) return;
  const newSteps = [...props.modelValue];
  const temp = newSteps[index];
  newSteps[index] = newSteps[index - 1];
  newSteps[index - 1] = temp;
  emit("update:modelValue", newSteps);
}

function moveStepDown(index: number) {
  if (index === props.modelValue.length - 1) return;
  const newSteps = [...props.modelValue];
  const temp = newSteps[index];
  newSteps[index] = newSteps[index + 1];
  newSteps[index + 1] = temp;
  emit("update:modelValue", newSteps);
}

// Drag and drop handlers
function onDragStart(index: number) {
  draggedIndex.value = index;
}

function onDragOver(event: DragEvent, index: number) {
  event.preventDefault();
  dragOverIndex.value = index;
}

function onDragLeave() {
  dragOverIndex.value = null;
}

function onDrop(index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) {
    draggedIndex.value = null;
    dragOverIndex.value = null;
    return;
  }

  const newSteps = [...props.modelValue];
  const [draggedStep] = newSteps.splice(draggedIndex.value, 1);
  newSteps.splice(index, 0, draggedStep);
  emit("update:modelValue", newSteps);

  draggedIndex.value = null;
  dragOverIndex.value = null;
}

function onDragEnd() {
  draggedIndex.value = null;
  dragOverIndex.value = null;
}
</script>

<template>
  <div class="test-steps-editor">
    <div v-if="steps.length === 0" class="empty-steps">
      <i class="pi pi-list"></i>
      <p>No test steps defined</p>
      <Button label="Add First Step" icon="pi pi-plus" @click="addStep" />
    </div>

    <div v-else class="steps-list">
      <div
        v-for="(step, index) in steps"
        :key="index"
        class="step-item"
        :class="{
          'is-dragging': draggedIndex === index,
          'drag-over': dragOverIndex === index,
        }"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover="onDragOver($event, index)"
        @dragleave="onDragLeave"
        @drop="onDrop(index)"
        @dragend="onDragEnd"
      >
        <div class="step-handle">
          <i class="pi pi-bars"></i>
        </div>

        <div class="step-content">
          <div class="step-header">
            <span class="step-number">Step {{ index + 1 }}</span>
            <div class="step-actions">
              <Button
                icon="pi pi-arrow-up"
                text
                rounded
                severity="secondary"
                size="small"
                :disabled="index === 0"
                @click="moveStepUp(index)"
                v-tooltip.top="'Move up'"
              />
              <Button
                icon="pi pi-arrow-down"
                text
                rounded
                severity="secondary"
                size="small"
                :disabled="index === steps.length - 1"
                @click="moveStepDown(index)"
                v-tooltip.top="'Move down'"
              />
              <Button
                icon="pi pi-copy"
                text
                rounded
                severity="secondary"
                size="small"
                @click="duplicateStep(index)"
                v-tooltip.top="'Duplicate'"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                size="small"
                @click="removeStep(index)"
                v-tooltip.top="'Delete'"
              />
            </div>
          </div>

          <div class="step-fields">
            <div class="field">
              <label>Action</label>
              <RichTextEditor
                :modelValue="step.step"
                @update:modelValue="updateStep(index, 'step', $event)"
                placeholder="Describe what action to perform..."
                minHeight="60px"
              />
            </div>
            <div class="field">
              <label>Expected Result</label>
              <RichTextEditor
                :modelValue="step.expected"
                @update:modelValue="updateStep(index, 'expected', $event)"
                placeholder="Describe the expected outcome..."
                minHeight="60px"
              />
            </div>
          </div>
        </div>
      </div>

      <Button
        label="Add Step"
        icon="pi pi-plus"
        text
        @click="addStep"
        class="add-step-btn"
      />
    </div>
  </div>
</template>

<style scoped>
.test-steps-editor {
  display: flex;
  flex-direction: column;
}

.empty-steps {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: var(--text-color-secondary);
  background: var(--surface-ground);
  border-radius: 8px;
  border: 2px dashed var(--surface-border);
}

.empty-steps i {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-steps p {
  margin-bottom: 16px;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.step-item:hover {
  border-color: var(--primary-200);
}

.step-item.is-dragging {
  opacity: 0.5;
  border-style: dashed;
}

.step-item.drag-over {
  border-color: var(--primary-color);
  background: var(--primary-50);
}

.step-handle {
  display: flex;
  align-items: flex-start;
  padding-top: 8px;
  cursor: grab;
  color: var(--text-color-secondary);
}

.step-handle:active {
  cursor: grabbing;
}

.step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.step-number {
  font-weight: 600;
  font-size: 14px;
  color: var(--primary-color);
  background: var(--primary-50);
  padding: 4px 12px;
  border-radius: 16px;
}

.step-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.step-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .step-fields {
    grid-template-columns: 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.w-full {
  width: 100%;
}

.add-step-btn {
  margin-top: 8px;
  align-self: flex-start;
}
</style>
