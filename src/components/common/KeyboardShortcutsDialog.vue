<script setup lang="ts">
import Dialog from "primevue/dialog";

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
}>();

const shortcuts = [
  { key: "?", description: "Open this help dialog" },
  { key: "1", description: "Mark test as Passed (execution view)" },
  { key: "2", description: "Mark test as Failed (execution view)" },
  { key: "3", description: "Mark test as Blocked (execution view)" },
  { key: "4", description: "Mark test as No Run (execution view)" },
  { key: "Tab", description: "Navigate between focusable elements" },
  { key: "Enter / Space", description: "Activate focused button or control" },
  { key: "Esc", description: "Close dialogs and panels" },
];
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Keyboard Shortcuts"
    :style="{ width: '480px' }"
    modal
  >
    <table class="shortcuts-table">
      <thead>
        <tr>
          <th>Key</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="shortcut in shortcuts" :key="shortcut.key">
          <td>
            <kbd class="key-badge">{{ shortcut.key }}</kbd>
          </td>
          <td>{{ shortcut.description }}</td>
        </tr>
      </tbody>
    </table>
    <template #footer>
      <span class="hint"
        >Shortcuts are disabled while typing in input fields.</span
      >
    </template>
  </Dialog>
</template>

<style scoped>
.shortcuts-table {
  width: 100%;
  border-collapse: collapse;
}

.shortcuts-table th {
  text-align: left;
  padding: 8px 12px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-color-secondary);
  border-bottom: 1px solid var(--surface-border);
}

.shortcuts-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--surface-border);
  font-size: 0.875rem;
}

.shortcuts-table tr:last-child td {
  border-bottom: none;
}

.key-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--text-color);
  white-space: nowrap;
}

.hint {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}
</style>
