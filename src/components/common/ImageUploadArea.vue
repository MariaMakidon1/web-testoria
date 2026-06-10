<script setup lang="ts">
import { ref, computed } from "vue";
import Button from "primevue/button";

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
}

const props = withDefaults(
  defineProps<{
    modelValue: UploadedImage[];
    maxFiles?: number;
    maxFileSize?: number; // in bytes
    disabled?: boolean;
  }>(),
  {
    maxFiles: 5,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: UploadedImage[]): void;
  (e: "error", message: string): void;
}>();

const isDragging = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const canAddMore = computed(() => props.modelValue.length < props.maxFiles);

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
  if (file.size > props.maxFileSize) {
    return `"${file.name}" exceeds the maximum file size of ${formatFileSize(props.maxFileSize)}`;
  }
  return null;
}

async function processFiles(files: FileList | File[]) {
  if (props.disabled) return;

  uploading.value = true;
  const fileArray = Array.from(files);
  const newImages: UploadedImage[] = [];
  const availableSlots = props.maxFiles - props.modelValue.length;

  for (let i = 0; i < Math.min(fileArray.length, availableSlots); i++) {
    const file = fileArray[i];
    const error = validateFile(file);

    if (error) {
      emit("error", error);
      continue;
    }

    try {
      const preview = await readFileAsDataURL(file);
      newImages.push({
        id: generateId(),
        file,
        preview,
        name: file.name,
        size: file.size,
      });
    } catch (_err) {
      emit("error", `Failed to read file "${file.name}"`);
    }
  }

  if (fileArray.length > availableSlots) {
    emit("error", `Only ${availableSlots} more image(s) can be added`);
  }

  if (newImages.length > 0) {
    emit("update:modelValue", [...props.modelValue, ...newImages]);
  }

  uploading.value = false;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  if (!props.disabled && canAddMore.value) {
    isDragging.value = true;
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  if (e.dataTransfer?.files) {
    processFiles(e.dataTransfer.files);
  }
}

function handlePaste(e: ClipboardEvent) {
  if (props.disabled || !canAddMore.value) return;

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

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) {
    processFiles(input.files);
    input.value = ""; // Reset to allow selecting same file again
  }
}

function openFilePicker() {
  fileInput.value?.click();
}

function removeImage(id: string) {
  emit(
    "update:modelValue",
    props.modelValue.filter((img) => img.id !== id),
  );
}

// Expose paste handler for parent component
defineExpose({ handlePaste });
</script>

<template>
  <div
    class="image-upload-area"
    :class="{ dragging: isDragging, disabled, uploading }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Upload Overlay -->
    <div v-if="uploading" class="upload-overlay">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Processing...</span>
    </div>

    <!-- Image Previews -->
    <div v-if="modelValue.length > 0" class="image-previews">
      <div v-for="image in modelValue" :key="image.id" class="image-preview">
        <img :src="image.preview" :alt="image.name" />
        <div class="image-overlay">
          <span class="image-name" :title="image.name">{{ image.name }}</span>
          <span class="image-size">{{ formatFileSize(image.size) }}</span>
        </div>
        <Button
          icon="pi pi-times"
          rounded
          text
          severity="danger"
          size="small"
          class="remove-btn"
          @click="removeImage(image.id)"
          :disabled="disabled"
          aria-label="Remove image"
        />
      </div>
    </div>

    <!-- Drop Zone -->
    <div
      v-if="canAddMore"
      class="drop-zone"
      :class="{ 'has-images': modelValue.length > 0 }"
      @click="openFilePicker"
    >
      <i class="pi pi-image"></i>
      <div class="drop-text">
        <span class="primary-text">
          {{
            isDragging
              ? "Drop image here"
              : "Drag & drop image or click to upload"
          }}
        </span>
        <span class="secondary-text"> or paste from clipboard (Ctrl+V) </span>
      </div>
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden-input"
      @change="handleFileSelect"
      :disabled="disabled"
    />

    <!-- Capacity Indicator -->
    <div v-if="modelValue.length > 0" class="capacity-indicator">
      {{ modelValue.length }}/{{ maxFiles }} images
    </div>
  </div>
</template>

<style scoped>
.image-upload-area {
  position: relative;
  border: 2px dashed var(--surface-border);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s ease;
  background-color: var(--surface-hover);
}

.image-upload-area.dragging {
  border-color: var(--primary-500, #667eea);
  background-color: var(--highlight-bg);
}

.image-upload-area.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.image-upload-area.uploading {
  pointer-events: none;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: rgba(var(--surface-card-rgb, 255 255 255) / 0.85);
  border-radius: 8px;
  z-index: 10;
  font-size: 0.875rem;
  color: var(--primary-500, #667eea);
}

.upload-overlay i {
  font-size: 1.5rem;
}

.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.image-preview {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  background-color: var(--surface-card);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 6px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.image-name {
  font-size: 0.65rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-size {
  font-size: 0.6rem;
  opacity: 0.8;
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 24px !important;
  height: 24px !important;
  background-color: var(--surface-card) !important;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.drop-zone:hover {
  background-color: var(--surface-100);
}

.drop-zone.has-images {
  padding: 12px;
  border-top: 1px dashed var(--surface-border);
  margin-top: 4px;
}

.drop-zone i {
  font-size: 1.5rem;
  color: var(--surface-400);
  margin-bottom: 8px;
}

.drop-zone.has-images i {
  font-size: 1rem;
  margin-bottom: 4px;
}

.drop-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}

.primary-text {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.secondary-text {
  font-size: 0.7rem;
  color: var(--surface-400);
}

.drop-zone.has-images .primary-text {
  font-size: 0.75rem;
}

.drop-zone.has-images .secondary-text {
  display: none;
}

.hidden-input {
  display: none;
}

.capacity-indicator {
  text-align: right;
  font-size: 0.65rem;
  color: var(--surface-400);
  margin-top: 4px;
}
</style>
