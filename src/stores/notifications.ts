import { defineStore } from "pinia";
import { ref, computed } from "vue";

export type NotificationType = "success" | "info" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
  createdAt: Date;
}

export interface NotificationOptions {
  title: string;
  message?: string;
  type?: NotificationType;
  duration?: number;
  closable?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

const DEFAULT_DURATION = 5000;

export const useNotificationsStore = defineStore("notifications", () => {
  const notifications = ref<Notification[]>([]);
  const maxNotifications = ref(5);

  const activeNotifications = computed(() =>
    notifications.value.slice(0, maxNotifications.value),
  );

  function generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function add(options: NotificationOptions): string {
    const id = generateId();
    const notification: Notification = {
      id,
      type: options.type || "info",
      title: options.title,
      message: options.message,
      duration: options.duration ?? DEFAULT_DURATION,
      closable: options.closable ?? true,
      action: options.action,
      createdAt: new Date(),
    };

    notifications.value.unshift(notification);

    // Auto-remove if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        remove(id);
      }, notification.duration);
    }

    // Remove excess notifications
    if (notifications.value.length > maxNotifications.value * 2) {
      notifications.value = notifications.value.slice(
        0,
        maxNotifications.value,
      );
    }

    return id;
  }

  function remove(id: string): void {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  }

  function clear(): void {
    notifications.value = [];
  }

  // Convenience methods
  function success(title: string, message?: string): string {
    return add({ type: "success", title, message });
  }

  function info(title: string, message?: string): string {
    return add({ type: "info", title, message });
  }

  function warning(title: string, message?: string): string {
    return add({ type: "warning", title, message });
  }

  function error(title: string, message?: string): string {
    return add({ type: "error", title, message, duration: 8000 });
  }

  return {
    notifications,
    activeNotifications,
    maxNotifications,
    add,
    remove,
    clear,
    success,
    info,
    warning,
    error,
  };
});
