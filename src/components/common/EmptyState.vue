<script setup lang="ts">
import Button from "primevue/button";

withDefaults(
  defineProps<{
    icon?: string;
    title?: string;
    message?: string;
    actionLabel?: string;
    actionIcon?: string;
    compact?: boolean;
  }>(),
  {
    icon: "pi pi-inbox",
    title: "No data found",
    message: "There is nothing to display yet.",
    compact: false,
  },
);

const emit = defineEmits<{
  (e: "action"): void;
}>();
</script>

<template>
  <div class="empty-state" :class="{ compact }">
    <i :class="icon" class="empty-icon"></i>
    <h3 class="empty-title">{{ title }}</h3>
    <p class="empty-message">{{ message }}</p>
    <Button
      v-if="actionLabel"
      :label="actionLabel"
      :icon="actionIcon"
      @click="emit('action')"
      class="empty-action"
    />
    <slot name="actions"></slot>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.empty-state.compact {
  padding: 32px 16px;
}

.empty-icon {
  font-size: 4rem;
  color: var(--text-color-secondary);
  opacity: 0.5;
  margin-bottom: 16px;
}

.compact .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 8px 0;
}

.compact .empty-title {
  font-size: 1rem;
}

.empty-message {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin: 0 0 20px 0;
  max-width: 400px;
  line-height: 1.5;
}

.compact .empty-message {
  margin-bottom: 16px;
}

.empty-action {
  margin-top: 8px;
}
</style>
