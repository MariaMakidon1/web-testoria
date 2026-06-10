<script setup lang="ts">
import { computed } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";

type DialogType = "info" | "warning" | "danger" | "success";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    type?: DialogType;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmIcon?: string;
    loading?: boolean;
    closable?: boolean;
    width?: string;
  }>(),
  {
    type: "warning",
    title: "Confirm Action",
    message: "Are you sure you want to proceed?",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    loading: false,
    closable: true,
    width: "450px",
  },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const typeConfig = computed(() => {
  const configs: Record<
    DialogType,
    {
      icon: string;
      severity: "danger" | "warning" | "success" | "info";
      color: string;
    }
  > = {
    danger: {
      icon: "pi pi-exclamation-triangle",
      severity: "danger",
      color: "#ef4444",
    },
    warning: {
      icon: "pi pi-exclamation-circle",
      severity: "warning",
      color: "#f59e0b",
    },
    success: {
      icon: "pi pi-check-circle",
      severity: "success",
      color: "#22c55e",
    },
    info: {
      icon: "pi pi-info-circle",
      severity: "info",
      color: "#3b82f6",
    },
  };
  return configs[props.type];
});

function handleConfirm() {
  emit("confirm");
}

function handleCancel() {
  emit("cancel");
  emit("update:visible", false);
}

function handleClose() {
  if (props.closable && !props.loading) {
    emit("update:visible", false);
    emit("cancel");
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="title"
    :style="{ width }"
    :closable="closable && !loading"
    :modal="true"
    :draggable="false"
    @update:visible="$emit('update:visible', $event)"
    @hide="handleClose"
  >
    <div class="confirm-content">
      <div
        class="confirm-icon"
        :style="{ backgroundColor: `${typeConfig.color}15` }"
      >
        <i :class="typeConfig.icon" :style="{ color: typeConfig.color }"></i>
      </div>
      <div class="confirm-message">
        <slot>{{ message }}</slot>
      </div>
    </div>

    <template #footer>
      <div class="confirm-actions">
        <Button
          :label="cancelLabel"
          severity="secondary"
          text
          :disabled="loading"
          @click="handleCancel"
        />
        <Button
          :label="confirmLabel"
          :icon="confirmIcon || typeConfig.icon"
          :severity="typeConfig.severity"
          :loading="loading"
          @click="handleConfirm"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 0;
}

.confirm-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-icon i {
  font-size: 1.5rem;
}

.confirm-message {
  flex: 1;
  color: var(--text-color);
  line-height: 1.5;
  padding-top: 12px;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
