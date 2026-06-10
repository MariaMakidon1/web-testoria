<script setup lang="ts">
import { computed } from "vue";
import Tag from "primevue/tag";
import { statusLabel } from "@/utils/statusLabel";

type BadgeType = "result" | "priority" | "run" | "type" | "custom";

const props = withDefaults(
  defineProps<{
    value: string;
    type?: BadgeType;
    size?: "small" | "normal" | "large";
    icon?: string;
    customColor?: string;
    customBackground?: string;
  }>(),
  {
    type: "custom",
    size: "normal",
  },
);

// Result status palette — colors aligned with --status-* CSS variables
// and `RESULT_STATUS_COLORS` (src/types/testResult.ts) so badges match the
// row indicators in the suite tree. Blocked is slate-gray (not warning-yellow)
// so it can never be confused with passed-green (TES-78, plan-087).
// All bg/fg pairs verified against WCAG AA for tag-sized text.
const resultBadgeStyles: Record<
  string,
  { bg: string; fg: string; icon: string }
> = {
  passed: { bg: "#dcfce7", fg: "#166534", icon: "pi pi-check-circle" },
  failed: { bg: "#fee2e2", fg: "#991b1b", icon: "pi pi-times-circle" },
  blocked: { bg: "#4b5563", fg: "#ffffff", icon: "pi pi-ban" },
  no_run: { bg: "#f3f4f6", fg: "#374151", icon: "pi pi-minus-circle" },
};

// Priority colors (critical, high, medium, low)
const priorityColors: Record<string, { severity: string; icon: string }> = {
  critical: { severity: "danger", icon: "pi pi-exclamation-triangle" },
  high: { severity: "warning", icon: "pi pi-arrow-up" },
  medium: { severity: "info", icon: "pi pi-minus" },
  low: { severity: "success", icon: "pi pi-arrow-down" },
};

// Test run status colors (planned, active, completed, aborted)
const runColors: Record<string, { severity: string; icon: string }> = {
  planned: { severity: "info", icon: "pi pi-clock" },
  active: { severity: "warning", icon: "pi pi-play" },
  completed: { severity: "success", icon: "pi pi-check" },
  aborted: { severity: "danger", icon: "pi pi-stop" },
};

// Test case type colors (automated, manual)
const typeColors: Record<string, { severity: string; icon: string }> = {
  automated: { severity: "success", icon: "pi pi-cog" },
  manual: { severity: "secondary", icon: "pi pi-user" },
};

const displayValue = computed(() => {
  if (props.type === "result") return statusLabel(props.value);
  return props.value;
});

const badgeConfig = computed(() => {
  let config = { severity: "secondary", icon: "" };

  switch (props.type) {
    case "result": {
      // Result-type badges use the custom slate/green/red palette below
      // via customStyle; severity is left at the neutral default so the
      // inline style is the visual source of truth.
      const style = resultBadgeStyles[props.value];
      return {
        severity: "secondary" as const,
        icon: props.icon || style?.icon || "",
      };
    }
    case "priority":
      config = priorityColors[props.value] || config;
      break;
    case "run":
      config = runColors[props.value] || config;
      break;
    case "type":
      config = typeColors[props.value] || config;
      break;
  }

  return {
    severity: config.severity as
      | "success"
      | "info"
      | "warning"
      | "danger"
      | "secondary"
      | "contrast",
    icon: props.icon || config.icon,
  };
});

const sizeClass = computed(() => {
  switch (props.size) {
    case "small":
      return "badge-small";
    case "large":
      return "badge-large";
    default:
      return "";
  }
});

// Per-status class so dark-mode tweaks can target individual result chips
// without fighting the inline `:style` colors.
const resultStatusClass = computed(() => {
  if (props.type !== "result") return "";
  return resultBadgeStyles[props.value]
    ? `status-badge--result-${props.value}`
    : "";
});

const customStyle = computed(() => {
  if (props.customColor || props.customBackground) {
    return {
      color: props.customColor,
      backgroundColor: props.customBackground,
    };
  }
  if (props.type === "result") {
    const style = resultBadgeStyles[props.value];
    if (style) {
      return { color: style.fg, backgroundColor: style.bg };
    }
  }
  return undefined;
});
</script>

<template>
  <Tag
    :value="displayValue"
    :severity="badgeConfig.severity"
    :icon="badgeConfig.icon"
    :class="['status-badge', sizeClass, resultStatusClass]"
    :style="customStyle"
  />
</template>

<style scoped>
.status-badge {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Add gap between icon and text */
.status-badge :deep(.p-tag-icon) {
  margin-right: 0;
}

.status-badge :deep(.p-tag-value) {
  line-height: 1;
}

.badge-small {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  gap: 4px;
}

.badge-large {
  font-size: 1rem;
  padding: 0.5rem 1rem;
  gap: 8px;
}

/* Dark mode: the slate-600 blocked chip ($4b5563) sits on a near-equally dark
 * surface ($1e293b card / $0f172a page), giving ~1.9:1 contrast against the
 * surface — text-readable but the chip silhouette is faint. Add a subtle
 * inset highlight so the chip outline reads. Light mode is unaffected. */
[data-theme="dark"] .status-badge.status-badge--result-blocked {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}
</style>
