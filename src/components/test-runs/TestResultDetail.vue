<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import type {
  TestResult,
  TestResultHistory,
  Attachment,
  Defect,
} from "@/types/testResult";
import { useTestResultsStore } from "@/stores/testResults";
import { useAuthStore } from "@/stores/auth";
import StatusBadge from "@/components/common/StatusBadge.vue";
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";
import Button from "primevue/button";
import Badge from "primevue/badge";
import Textarea from "primevue/textarea";
import Dialog from "primevue/dialog";
import { useToast } from "primevue/usetoast";
import TestResultHistoryPanel from "./TestResultHistoryPanel.vue";
import DefectsPanel from "./DefectsPanel.vue";

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
}

const props = defineProps<{
  result: TestResult | null;
  history?: TestResultHistory[];
  loading?: boolean;
  suiteName?: string | null;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "edit-test-case", result: TestResult): void;
  (e: "execute-result", result: TestResult): void;
  (
    e: "update-comment",
    data: { comment: string; images: UploadedImage[] },
  ): void;
}>();

const toast = useToast();
const testResultsStore = useTestResultsStore();
const authStore = useAuthStore();

async function handleAddDefect(defect: Defect) {
  if (!props.result?.id) return;
  try {
    await testResultsStore.addDefectToResult(props.result.id, defect);
  } catch {
    toast.add({
      severity: "error",
      summary: "Failed to link defect",
      life: 4000,
    });
  }
}

async function handleRemoveDefect(key: string) {
  if (!props.result?.id) return;
  try {
    await testResultsStore.removeDefectFromResult(props.result.id, key);
  } catch {
    toast.add({
      severity: "error",
      summary: "Failed to remove defect",
      life: 4000,
    });
  }
}
const activeTabIndex = ref(0);
const commentText = ref("");
const commentImages = ref<UploadedImage[]>([]);
const isEditingComment = ref(false);
const isDragging = ref(false);
const commentAreaRef = ref<HTMLElement | null>(null);

// Image preview dialog state
const showImagePreview = ref(false);
const previewImage = ref<Attachment | null>(null);

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const displayTitle = computed(() => {
  if (!props.result) return "";
  return (
    props.result.test_case?.title || `Test Case #${props.result.test_case_id}`
  );
});

const testCaseId = computed(() => {
  if (!props.result) return "";
  const id = props.result.test_case?.id || props.result.test_case_id;
  return `T${id}`;
});

const formattedTime = computed(() => {
  if (!props.result?.execution_time) return "None";
  const seconds = props.result.execution_time;
  if (seconds < 60) return `${seconds}sec`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
});

const formattedDate = computed(() => {
  if (!props.result?.tested_at) return "-";
  const date = new Date(props.result.tested_at);
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const defectsCount = computed(() => {
  return props.result?.defects?.length || 0;
});

const hasCommentContent = computed(() => {
  return commentText.value.trim() || commentImages.value.length > 0;
});

const isSynthetic = computed(() => props.result?.id == null);

const canAddMoreImages = computed(
  () => commentImages.value.length < MAX_IMAGES,
);

// Watch for result changes and reset state
watch(
  () => props.result?.id,
  () => {
    activeTabIndex.value = 0;
    resetCommentEdit();
  },
);

// Initialize comment text from result
watch(
  () => props.result?.comment,
  (newComment) => {
    if (!isEditingComment.value) {
      commentText.value = newComment || "";
    }
  },
  { immediate: true },
);

function resetCommentEdit() {
  commentText.value = props.result?.comment || "";
  commentImages.value = [];
  isEditingComment.value = false;
  isDragging.value = false;
}

function handleEditTestCase() {
  if (props.result) {
    emit("edit-test-case", props.result);
  }
}

function handleExecuteResult() {
  if (props.result) {
    emit("execute-result", props.result);
  }
}

function startEditComment() {
  isEditingComment.value = true;
}

function cancelEditComment() {
  resetCommentEdit();
}

function saveComment() {
  emit("update-comment", {
    comment: commentText.value,
    images: commentImages.value,
  });
}

defineExpose({ resetCommentEdit });

// Image handling functions
function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return `"${file.name}" is not an image file`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the maximum file size of ${formatFileSize(MAX_FILE_SIZE)}`;
  }
  return null;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function processFiles(files: File[]) {
  const availableSlots = MAX_IMAGES - commentImages.value.length;

  for (let i = 0; i < Math.min(files.length, availableSlots); i++) {
    const file = files[i];
    const error = validateFile(file);

    if (error) {
      toast.add({
        severity: "error",
        summary: "Upload Error",
        detail: error,
        life: 5000,
      });
      continue;
    }

    try {
      const preview = await readFileAsDataURL(file);
      commentImages.value.push({
        id: generateId(),
        file,
        preview,
        name: file.name,
        size: file.size,
      });
    } catch {
      toast.add({
        severity: "error",
        summary: "Upload Error",
        detail: `Failed to read file "${file.name}"`,
        life: 5000,
      });
    }
  }

  if (files.length > availableSlots) {
    toast.add({
      severity: "warn",
      summary: "Limit Reached",
      detail: `Only ${availableSlots} more image(s) can be added (max ${MAX_IMAGES})`,
      life: 5000,
    });
  }
}

function removeImage(id: string) {
  commentImages.value = commentImages.value.filter((img) => img.id !== id);
}

// Global paste handler (attached to document when editing)
function handleGlobalPaste(e: ClipboardEvent) {
  if (!isEditingComment.value || !canAddMoreImages.value) return;

  const items = e.clipboardData?.items;
  if (!items) return;

  const imageFiles: File[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        imageFiles.push(file);
      }
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    processFiles(imageFiles);
  }
}

// Watch editing state to add/remove global paste listener
watch(isEditingComment, (editing) => {
  if (editing) {
    document.addEventListener("paste", handleGlobalPaste);
  } else {
    document.removeEventListener("paste", handleGlobalPaste);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener("paste", handleGlobalPaste);
});

// Drag and drop handlers
function handleDragOver(e: DragEvent) {
  e.preventDefault();
  if (isEditingComment.value && canAddMoreImages.value) {
    isDragging.value = true;
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  // Only set to false if we're leaving the comment area entirely
  const rect = commentAreaRef.value?.getBoundingClientRect();
  if (rect) {
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      isDragging.value = false;
    }
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  if (!isEditingComment.value || !canAddMoreImages.value) return;

  const files = e.dataTransfer?.files;
  if (files) {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (imageFiles.length > 0) {
      processFiles(imageFiles);
    }
  }
}

// Format attachment file size
function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Open image in preview dialog
function openImagePreview(attachment: Attachment) {
  previewImage.value = attachment;
  showImagePreview.value = true;
}

function closeImagePreview() {
  showImagePreview.value = false;
  previewImage.value = null;
}
</script>

<template>
  <div class="test-result-detail" v-if="result">
    <!-- Header -->
    <div class="detail-header">
      <div class="header-title">
        <span class="test-id">{{ testCaseId }}</span>
        <h2 class="title">{{ displayTitle }}</h2>
      </div>
      <div class="header-actions">
        <Button
          v-if="authStore.isProjectManager"
          data-testid="result-detail-edit-test-case"
          icon="pi pi-pencil"
          label="Edit"
          text
          size="small"
          @click="handleEditTestCase"
        />
        <Button
          icon="pi pi-times"
          text
          rounded
          severity="secondary"
          @click="emit('close')"
          aria-label="Close"
          class="close-btn"
        />
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="metadata-grid">
      <div v-if="suiteName" class="metadata-item">
        <span class="meta-label">Suite</span>
        <span class="meta-value">
          <i class="pi pi-folder meta-folder-icon"></i>
          {{ suiteName }}
        </span>
      </div>
      <div class="metadata-item">
        <span class="meta-label">Type</span>
        <span class="meta-value">{{ result.test_case?.type || "Other" }}</span>
      </div>
      <div class="metadata-item">
        <span class="meta-label">Priority</span>
        <StatusBadge
          v-if="result.test_case?.priority"
          :value="result.test_case.priority"
          type="priority"
          size="small"
        />
        <span v-else class="meta-value">-</span>
      </div>
    </div>

    <!-- Not yet run panel -->
    <div v-if="isSynthetic" class="not-run-panel">
      <StatusBadge value="no_run" type="result" size="large" />
      <p class="not-run-copy">
        This case has not been run yet. Open it in the execution view to record
        a result.
      </p>
      <Button
        data-testid="result-detail-execute"
        label="Execute"
        icon="pi pi-play"
        severity="primary"
        @click="handleExecuteResult"
      />
    </div>

    <!-- Tabs -->
    <template v-if="!isSynthetic">
    <TabView v-model:activeIndex="activeTabIndex" class="detail-tabs">
      <TabPanel value="0">
        <template #header>
          <span>Results & Comments</span>
          <Badge
            v-if="result.comment || result.message"
            value="1"
            severity="secondary"
            class="tab-badge"
          />
        </template>

        <!-- Result Status Card -->
        <div class="result-status-card" :class="result.status.toLowerCase()">
          <div class="status-header">
            <StatusBadge :value="result.status" type="result" size="large" />
            <div class="status-meta">
              <span class="status-date">{{ formattedDate }}</span>
              <span class="status-divider">|</span>
              <span class="status-user" v-if="result.tested_by"
                >User #{{ result.tested_by }}</span
              >
            </div>
          </div>

          <div class="elapsed-time">
            <span class="elapsed-label">Elapsed</span>
            <span class="elapsed-value">{{ formattedTime }}</span>
          </div>

          <!-- Message/Error -->
          <div class="result-message" v-if="result.message">
            <span class="message-label">Message:</span>
            <pre class="message-content">{{ result.message }}</pre>
          </div>

          <!-- Stack Trace -->
          <div class="stack-trace" v-if="result.stack_trace">
            <details>
              <summary>Stack Trace</summary>
              <pre class="trace-content">{{ result.stack_trace }}</pre>
            </details>
          </div>
        </div>

        <!-- Comment Section -->
        <div class="comment-section">
          <div class="comment-header">
            <span class="section-label">Comment</span>
            <div class="comment-actions" v-if="!isEditingComment">
              <Button
                icon="pi pi-pencil"
                label="Edit"
                text
                size="small"
                @click="startEditComment"
              />
            </div>
          </div>

          <!-- View Mode -->
          <div v-if="!isEditingComment" class="comment-view">
            <p v-if="result.comment" class="comment-text">
              {{ result.comment }}
            </p>
            <p v-else class="comment-empty">No comment provided</p>
          </div>

          <!-- Edit Mode -->
          <div
            v-else
            ref="commentAreaRef"
            class="comment-edit"
            :class="{ dragging: isDragging }"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <!-- Drag overlay -->
            <div v-if="isDragging" class="drag-overlay">
              <i class="pi pi-image"></i>
              <span>Drop image here</span>
            </div>

            <Textarea
              v-model="commentText"
              rows="4"
              class="comment-textarea"
              placeholder="Add your comment here... (Ctrl+V to paste images, or drag & drop)"
              autoResize
            />

            <!-- Image Previews -->
            <div v-if="commentImages.length > 0" class="image-previews">
              <div
                v-for="image in commentImages"
                :key="image.id"
                class="image-preview"
              >
                <img :src="image.preview" :alt="image.name" />
                <div class="image-info">
                  <span class="image-name" :title="image.name">{{
                    image.name
                  }}</span>
                  <span class="image-size">{{
                    formatFileSize(image.size)
                  }}</span>
                </div>
                <Button
                  icon="pi pi-times"
                  rounded
                  text
                  severity="danger"
                  size="small"
                  class="remove-btn"
                  @click="removeImage(image.id)"
                  aria-label="Remove image"
                />
              </div>
            </div>

            <!-- Hint text -->
            <div class="edit-hint" v-if="canAddMoreImages">
              <i class="pi pi-info-circle"></i>
              <span
                >Paste (Ctrl+V) or drag & drop images here ({{
                  commentImages.length
                }}/{{ MAX_IMAGES }})</span
              >
            </div>

            <!-- Edit Actions -->
            <div class="edit-actions">
              <Button
                label="Cancel"
                text
                size="small"
                :disabled="isSaving"
                @click="cancelEditComment"
              />
              <Button
                label="Save"
                icon="pi pi-check"
                size="small"
                :loading="isSaving"
                :disabled="(!hasCommentContent && !result.comment) || isSaving"
                @click="saveComment"
              />
            </div>
          </div>
        </div>

        <!-- Saved Attachments Section -->
        <div
          class="attachments-section"
          v-if="result.attachments && result.attachments.length > 0"
        >
          <span class="section-label"
            >Attachments ({{ result.attachments.length }})</span
          >
          <div class="saved-attachments">
            <div
              v-for="attachment in result.attachments"
              :key="attachment.id"
              class="saved-attachment"
            >
              <img
                v-if="attachment.mime_type?.startsWith('image/')"
                :src="attachment.url"
                :alt="attachment.filename"
                class="attachment-image"
                @click="openImagePreview(attachment)"
              />
              <div class="attachment-info">
                <span class="attachment-name" :title="attachment.filename">{{
                  attachment.filename
                }}</span>
                <span class="attachment-size">{{
                  formatAttachmentSize(attachment.file_size)
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="1">
        <template #header>
          <span>History & Context</span>
          <Badge
            v-if="history?.length"
            :value="history.length.toString()"
            severity="secondary"
            class="tab-badge"
          />
        </template>

        <TestResultHistoryPanel :history="history || []" :result="result" />
      </TabPanel>

      <TabPanel value="2">
        <template #header>
          <span>Defects</span>
          <Badge
            v-if="defectsCount > 0"
            :value="defectsCount.toString()"
            severity="danger"
            class="tab-badge"
          />
        </template>

        <DefectsPanel
          :defects="result.defects || []"
          @add-defect="handleAddDefect"
          @remove-defect="handleRemoveDefect"
        />
      </TabPanel>
    </TabView>
    </template>
  </div>

  <!-- Empty State -->
  <div class="no-result-selected" v-else>
    <i class="pi pi-info-circle"></i>
    <p>Select a test result to view details</p>
  </div>

  <!-- Image Preview Dialog -->
  <Dialog
    v-model:visible="showImagePreview"
    :header="previewImage?.filename || 'Image Preview'"
    :modal="true"
    :dismissableMask="true"
    :style="{ maxWidth: '90vw', maxHeight: '90vh' }"
    class="image-preview-dialog"
    @hide="closeImagePreview"
  >
    <div class="preview-container" v-if="previewImage">
      <img
        :src="previewImage.url"
        :alt="previewImage.filename"
        class="preview-image"
      />
    </div>
    <template #footer>
      <div class="preview-footer">
        <span class="preview-info"
          >{{ previewImage?.filename }} ({{
            formatAttachmentSize(previewImage?.file_size || 0)
          }})</span
        >
        <Button label="Close" icon="pi pi-times" @click="closeImagePreview" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.test-result-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--surface-card);
}

.not-run-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 20px;
  text-align: center;
}

.not-run-copy {
  color: var(--text-color-secondary);
  max-width: 360px;
  margin: 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--surface-border);
  gap: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.test-id {
  font-family: monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-600, #5a6fd6);
  background-color: var(--highlight-bg);
  padding: 4px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Close button - ensure icon is centered */
.close-btn {
  width: 2rem !important;
  height: 2rem !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.close-btn :deep(.p-button-icon) {
  margin: 0 !important;
  font-size: 1rem;
}

.close-btn :deep(.p-button-label) {
  display: none !important;
}

.labels-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-border);
}

.section-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.labels-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.label-tag {
  font-size: 0.75rem;
}

.add-label-btn {
  font-size: 0.75rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 16px;
  background-color: var(--surface-hover);
  border-bottom: 1px solid var(--surface-border);
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-folder-icon {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-right: 4px;
}

.meta-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.meta-value {
  font-size: 0.875rem;
  color: var(--text-color);
}

.automation-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-border);
}

.automation-id {
  display: block;
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  background-color: var(--surface-100);
  padding: 8px 12px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: nowrap;
}

.detail-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-tabs :deep(.p-tabview-panels) {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tab-badge {
  margin-left: 8px;
}

.result-status-card {
  background-color: var(--surface-hover);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.result-status-card.failed {
  background-color: var(--red-50, #fef2f2);
  border-color: var(--red-500, #ef4444);
}

.result-status-card.passed {
  background-color: var(--green-50, #f0fdf4);
  border-color: var(--green-500, #22c55e);
}

/* Blocked uses slate, not yellow — aligned with StatusBadge's blocked palette
 * and the canonical --status-blocked token (plan-087, fixes TES-78). The prior
 * yellow tint made the blocked status card visually confusable with the passed
 * status card (light pastel backgrounds with similar saturation). */
.result-status-card.blocked {
  background-color: rgba(75, 85, 99, 0.08);
  border-color: #4b5563;
}

[data-theme="dark"] .result-status-card.failed {
  background-color: rgba(239, 68, 68, 0.12);
  border-color: var(--red-500, #ef4444);
}

[data-theme="dark"] .result-status-card.passed {
  background-color: rgba(34, 197, 94, 0.12);
  border-color: var(--green-500, #22c55e);
}

[data-theme="dark"] .result-status-card.blocked {
  background-color: rgba(75, 85, 99, 0.22);
  border-color: #94a3b8;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.status-divider {
  color: var(--surface-border);
}

.elapsed-time {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
}

.elapsed-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.elapsed-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.result-message {
  margin-top: 12px;
}

.message-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  margin-bottom: 4px;
}

.message-content {
  font-family: monospace;
  font-size: 0.8rem;
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  padding: 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.stack-trace {
  margin-top: 12px;
}

.stack-trace summary {
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--primary-600, #5a6fd6);
  padding: 4px 0;
}

.stack-trace summary:hover {
  color: var(--primary-700, #4a5ab3);
}

.trace-content {
  font-family: monospace;
  font-size: 0.75rem;
  background-color: var(--gray-800, #1f2937);
  color: var(--surface-100);
  border-radius: 4px;
  padding: 12px;
  margin: 8px 0 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

/* Comment Section */
.comment-section {
  margin-top: 16px;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.comment-header .section-label {
  margin-bottom: 0;
}

.comment-view {
  background-color: var(--surface-hover);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 12px;
  min-height: 60px;
}

.comment-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  font-style: italic;
}

.comment-edit {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 2px dashed var(--surface-border);
  border-radius: 8px;
  background-color: var(--surface-hover);
  transition: all 0.2s ease;
}

.comment-edit.dragging {
  border-color: var(--primary-500, #667eea);
  background-color: var(--highlight-bg);
}

.drag-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: rgba(102, 126, 234, 0.9);
  color: white;
  border-radius: 6px;
  z-index: 10;
  pointer-events: none;
}

.drag-overlay i {
  font-size: 2rem;
}

.drag-overlay span {
  font-size: 0.875rem;
  font-weight: 500;
}

.comment-textarea {
  width: 100%;
  font-size: 0.875rem;
}

/* Image Previews */
.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-preview {
  position: relative;
  width: 120px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  background-color: var(--surface-card);
}

.image-preview img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
}

.image-info {
  padding: 4px 6px;
  background-color: var(--surface-100);
}

.image-name {
  display: block;
  font-size: 0.65rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-size {
  display: block;
  font-size: 0.6rem;
  color: var(--text-color-secondary);
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px !important;
  height: 22px !important;
  background-color: var(--surface-card) !important;
}

.edit-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

.edit-hint i {
  font-size: 0.75rem;
  color: var(--primary-500, #667eea);
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--surface-border);
}

.no-result-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-color-secondary);
  gap: 12px;
}

.no-result-selected i {
  font-size: 2rem;
  color: var(--surface-400);
}

.no-result-selected p {
  margin: 0;
  font-size: 0.875rem;
}

/* Attachments Section */
.attachments-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--surface-border);
}

.saved-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.saved-attachment {
  width: 140px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--surface-card);
  transition: box-shadow 0.2s ease;
}

.saved-attachment:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.attachment-image {
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.attachment-image:hover {
  opacity: 0.9;
}

.attachment-info {
  padding: 8px;
  background-color: var(--surface-hover);
}

.attachment-name {
  display: block;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attachment-size {
  display: block;
  font-size: 0.6rem;
  color: var(--text-color-secondary);
  margin-top: 2px;
}

/* Image Preview Dialog */
.image-preview-dialog :deep(.p-dialog-content) {
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--gray-900, #111827);
}

.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 70vh;
  overflow: auto;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.preview-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.preview-info {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .metadata-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .saved-attachment {
    width: 120px;
  }

  .attachment-image {
    height: 80px;
  }
}
</style>
