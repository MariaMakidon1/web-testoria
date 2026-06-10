<script setup lang="ts">
import { ref } from "vue";
import type { ResultStatus } from "@/types/testResult";
import { RESULT_STATUS_COLORS } from "@/types/testResult";

const props = defineProps<{
  status?: ResultStatus | null;
  comment?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:status", status: ResultStatus | null): void;
  (e: "update:comment", comment: string): void;
}>();

const showComment = ref(false);

const statuses: { key: ResultStatus; label: string; short: string }[] = [
  { key: "passed", label: "Passed", short: "P" },
  { key: "failed", label: "Failed", short: "F" },
  { key: "blocked", label: "Blocked", short: "B" },
  { key: "no_run", label: "No Run", short: "N" },
];

function handleClick(key: ResultStatus) {
  if (props.status === key) {
    emit("update:status", null);
  } else {
    emit("update:status", key);
  }
}

function toggleComment() {
  showComment.value = !showComment.value;
}
</script>

<template>
  <div class="step-status-picker">
    <div class="status-buttons">
      <button
        v-for="s in statuses"
        :key="s.key"
        class="status-btn"
        :class="{ active: status === s.key }"
        :style="
          status === s.key
            ? { backgroundColor: RESULT_STATUS_COLORS[s.key], color: '#fff' }
            : {}
        "
        :aria-label="`Mark step as ${s.label}`"
        :aria-pressed="status === s.key"
        @click="handleClick(s.key)"
      >
        {{ s.short }}
      </button>
      <button
        class="comment-toggle"
        :class="{ 'has-comment': !!comment }"
        aria-label="Toggle step comment"
        @click="toggleComment"
      >
        <i class="pi pi-comment"></i>
      </button>
    </div>
    <div v-if="showComment" class="step-comment">
      <textarea
        :value="comment || ''"
        placeholder="Step comment..."
        maxlength="1000"
        rows="2"
        class="step-comment-input"
        @input="
          emit('update:comment', ($event.target as HTMLTextAreaElement).value)
        "
      />
    </div>
  </div>
</template>

<style scoped>
.step-status-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

.status-btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--surface-300);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--text-color-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}

.status-btn:hover {
  border-color: var(--surface-400);
  background: var(--surface-hover);
}

.status-btn.active {
  border-color: transparent;
}

.comment-toggle {
  width: 26px;
  height: 26px;
  border: 1px solid var(--surface-300);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--text-color-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.comment-toggle:hover {
  border-color: var(--surface-400);
}

.comment-toggle.has-comment {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.step-comment-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--surface-300);
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: inherit;
  resize: vertical;
  background: var(--surface-card);
  color: var(--text-color);
}

.step-comment-input:focus {
  outline: none;
  border-color: var(--primary-color);
}
</style>
