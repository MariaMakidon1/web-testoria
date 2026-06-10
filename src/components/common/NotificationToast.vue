<script setup lang="ts">
import { computed } from "vue";
import {
  useNotificationsStore,
  type Notification,
} from "@/stores/notifications";
import Button from "primevue/button";

const notificationsStore = useNotificationsStore();

const notifications = computed(() => notificationsStore.activeNotifications);

function getIcon(type: Notification["type"]): string {
  const icons: Record<Notification["type"], string> = {
    success: "pi pi-check-circle",
    info: "pi pi-info-circle",
    warning: "pi pi-exclamation-triangle",
    error: "pi pi-times-circle",
  };
  return icons[type];
}

function getTypeClass(type: Notification["type"]): string {
  return `notification-${type}`;
}

function handleClose(id: string): void {
  notificationsStore.remove(id);
}

function handleAction(notification: Notification): void {
  notification.action?.handler();
  handleClose(notification.id);
}
</script>

<template>
  <Teleport to="body">
    <div class="notification-container">
      <TransitionGroup name="notification">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-toast"
          :class="getTypeClass(notification.type)"
        >
          <div class="notification-icon">
            <i :class="getIcon(notification.type)"></i>
          </div>

          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div v-if="notification.message" class="notification-message">
              {{ notification.message }}
            </div>
            <div v-if="notification.action" class="notification-action">
              <Button
                :label="notification.action.label"
                text
                size="small"
                @click="handleAction(notification)"
              />
            </div>
          </div>

          <button
            v-if="notification.closable"
            class="notification-close"
            @click="handleClose(notification.id)"
            aria-label="Close notification"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
  pointer-events: none;
}

.notification-toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--surface-card);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid;
  pointer-events: auto;
}

.notification-toast.notification-success {
  border-left-color: #22c55e;
}

.notification-toast.notification-info {
  border-left-color: #3b82f6;
}

.notification-toast.notification-warning {
  border-left-color: #f59e0b;
}

.notification-toast.notification-error {
  border-left-color: #ef4444;
}

.notification-icon {
  flex-shrink: 0;
  font-size: 1.25rem;
}

.notification-success .notification-icon {
  color: #22c55e;
}

.notification-info .notification-icon {
  color: #3b82f6;
}

.notification-warning .notification-icon {
  color: #f59e0b;
}

.notification-error .notification-icon {
  color: #ef4444;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
}

.notification-message {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  line-height: 1.4;
}

.notification-action {
  margin-top: 8px;
}

.notification-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-color-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition:
    background 0.2s,
    color 0.2s;
}

.notification-close:hover {
  background: var(--surface-hover);
  color: var(--text-color);
}

/* Transitions */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

@media (max-width: 480px) {
  .notification-container {
    left: 12px;
    right: 12px;
    max-width: none;
  }
}
</style>
