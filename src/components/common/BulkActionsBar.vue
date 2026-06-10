<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import ConfirmDialog from "./ConfirmDialog.vue";
import type { BulkOperation } from "@/composables/useBulkOperations";

const props = defineProps<{
  selectedCount: number;
  operations: BulkOperation<unknown>[];
  processing: boolean;
  currentOperation: string | null;
}>();

const emit = defineEmits<{
  (e: "execute", operationId: string): void;
  (e: "clear"): void;
}>();

const showConfirm = ref(false);
const pendingOperation = ref<BulkOperation<unknown> | null>(null);
const confirmMessage = ref("");

function handleOperationClick(operation: BulkOperation<unknown>) {
  if (operation.confirmMessage) {
    pendingOperation.value = operation;
    if (typeof operation.confirmMessage === "function") {
      confirmMessage.value = operation.confirmMessage(props.selectedCount);
    } else {
      confirmMessage.value = operation.confirmMessage;
    }
    showConfirm.value = true;
  } else {
    emit("execute", operation.id);
  }
}

function handleConfirm() {
  if (pendingOperation.value) {
    emit("execute", pendingOperation.value.id);
  }
  showConfirm.value = false;
  pendingOperation.value = null;
}

function handleCancel() {
  showConfirm.value = false;
  pendingOperation.value = null;
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="selectedCount > 0" class="bulk-actions-bar">
      <div class="selection-info">
        <i class="pi pi-check-square"></i>
        <span
          >{{ selectedCount }} item{{
            selectedCount !== 1 ? "s" : ""
          }}
          selected</span
        >
        <Button
          icon="pi pi-times"
          text
          rounded
          size="small"
          @click="emit('clear')"
          aria-label="Clear selection"
        />
      </div>

      <div class="actions">
        <Button
          v-for="operation in operations"
          :key="operation.id"
          :label="operation.label"
          :icon="operation.icon"
          :severity="operation.severity || 'secondary'"
          :loading="processing && currentOperation === operation.id"
          :disabled="processing && currentOperation !== operation.id"
          size="small"
          @click="handleOperationClick(operation)"
        />
      </div>
    </div>
  </Transition>

  <ConfirmDialog
    v-model:visible="showConfirm"
    :type="pendingOperation?.severity === 'danger' ? 'danger' : 'warning'"
    title="Confirm Bulk Action"
    :message="confirmMessage"
    :confirm-label="pendingOperation?.label || 'Confirm'"
    :loading="processing"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<style scoped>
.bulk-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--primary-50);
  border: 1px solid var(--primary-200);
  border-radius: 8px;
  margin-bottom: 16px;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--primary-700);
}

.selection-info i {
  font-size: 1.25rem;
}

.actions {
  display: flex;
  gap: 8px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
