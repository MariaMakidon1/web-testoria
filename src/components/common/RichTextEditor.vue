<script setup lang="ts">
import { watch, onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Button from "primevue/button";

const props = withDefaults(
  defineProps<{
    modelValue: string | undefined;
    placeholder?: string;
    minHeight?: string;
  }>(),
  {
    placeholder: "Start typing...",
    minHeight: "150px",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const editor = useEditor({
  content: props.modelValue ?? "",
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "editor-link",
      },
    }),
  ],
  onUpdate: ({ editor }) => {
    emit("update:modelValue", editor.getHTML());
  },
});

watch(
  () => props.modelValue,
  (newValue) => {
    const value = newValue ?? "";
    if (editor.value && value !== editor.value.getHTML()) {
      editor.value.commands.setContent(value, { emitUpdate: false });
    }
  },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});

function setLink() {
  if (!editor.value) return;

  const previousUrl = editor.value.getAttributes("link").href;
  const url = window.prompt("URL", previousUrl);

  if (url === null) return;

  if (url === "") {
    editor.value.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  editor.value
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: url })
    .run();
}
</script>

<template>
  <div class="rich-text-editor">
    <div v-if="editor" class="editor-toolbar">
      <div class="toolbar-group">
        <Button
          :class="{ active: editor.isActive('bold') }"
          text
          rounded
          size="small"
          aria-label="Bold"
          @click="editor.chain().focus().toggleBold().run()"
          v-tooltip.top="'Bold'"
        >
          <template #icon>
            <svg
              class="toolbar-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
              <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
            </svg>
          </template>
        </Button>
        <Button
          :class="{ active: editor.isActive('italic') }"
          text
          rounded
          size="small"
          aria-label="Italic"
          @click="editor.chain().focus().toggleItalic().run()"
          v-tooltip.top="'Italic'"
        >
          <template #icon>
            <svg
              class="toolbar-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="4" x2="10" y2="4" />
              <line x1="14" y1="20" x2="5" y2="20" />
              <line x1="15" y1="4" x2="9" y2="20" />
            </svg>
          </template>
        </Button>
        <Button
          :class="{ active: editor.isActive('strike') }"
          text
          rounded
          size="small"
          aria-label="Strikethrough"
          @click="editor.chain().focus().toggleStrike().run()"
          v-tooltip.top="'Strikethrough'"
        >
          <template #icon>
            <svg
              class="toolbar-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M16 4H9a3 3 0 0 0-2.83 4" />
              <path d="M14 12a4 4 0 0 1 0 8H6" />
              <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
          </template>
        </Button>
        <Button
          icon="pi pi-code"
          :class="{ active: editor.isActive('code') }"
          text
          rounded
          size="small"
          @click="editor.chain().focus().toggleCode().run()"
          v-tooltip.top="'Code'"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          icon="pi pi-list"
          :class="{ active: editor.isActive('bulletList') }"
          text
          rounded
          size="small"
          @click="editor.chain().focus().toggleBulletList().run()"
          v-tooltip.top="'Bullet List'"
        />
        <Button
          :class="{ active: editor.isActive('orderedList') }"
          text
          rounded
          size="small"
          aria-label="Numbered List"
          @click="editor.chain().focus().toggleOrderedList().run()"
          v-tooltip.top="'Numbered List'"
        >
          <template #icon>
            <svg
              class="toolbar-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="10" y1="6" x2="21" y2="6" />
              <line x1="10" y1="12" x2="21" y2="12" />
              <line x1="10" y1="18" x2="21" y2="18" />
              <path d="M4 6h1v4" />
              <path d="M4 10h2" />
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
            </svg>
          </template>
        </Button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          icon="pi pi-link"
          :class="{ active: editor.isActive('link') }"
          text
          rounded
          size="small"
          @click="setLink"
          v-tooltip.top="'Link'"
        />
        <Button
          icon="pi pi-window-maximize"
          :class="{ active: editor.isActive('codeBlock') }"
          text
          rounded
          size="small"
          @click="editor.chain().focus().toggleCodeBlock().run()"
          v-tooltip.top="'Code Block'"
        />
        <Button
          icon="pi pi-minus"
          text
          rounded
          size="small"
          @click="editor.chain().focus().setHorizontalRule().run()"
          v-tooltip.top="'Horizontal Rule'"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          icon="pi pi-undo"
          text
          rounded
          size="small"
          :disabled="!editor.can().undo()"
          @click="editor.chain().focus().undo().run()"
          v-tooltip.top="'Undo'"
        />
        <Button
          icon="pi pi-refresh"
          text
          rounded
          size="small"
          :disabled="!editor.can().redo()"
          @click="editor.chain().focus().redo().run()"
          v-tooltip.top="'Redo'"
        />
      </div>
    </div>

    <EditorContent
      :editor="editor"
      class="editor-content tiptap-content"
      :style="{ minHeight: minHeight }"
    />
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-ground);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-section);
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--surface-border);
  margin: 0 4px;
}

.editor-toolbar :deep(.p-button) {
  width: 32px;
  height: 32px;
  color: var(--text-color);
  background: transparent;
  border: 1px solid transparent;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.editor-toolbar :deep(.p-button .p-button-icon),
.editor-toolbar :deep(.p-button .toolbar-svg) {
  color: var(--text-color);
  font-size: 0.9rem;
}

.editor-toolbar :deep(.p-button:not(:disabled):hover) {
  background: var(--surface-hover);
  border-color: var(--surface-border);
  color: var(--text-color);
}

.editor-toolbar :deep(.p-button.active),
.editor-toolbar :deep(.p-button.active:not(:disabled):hover) {
  background: var(--primary-100, #e0e7ff);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.editor-toolbar :deep(.p-button.active .p-button-icon),
.editor-toolbar :deep(.p-button.active .toolbar-svg) {
  color: var(--primary-color);
}

.editor-toolbar :deep(.p-button:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-svg {
  width: 14px;
  height: 14px;
}

.editor-content {
  padding: 12px;
}

.editor-content :deep(.tiptap) {
  outline: none;
  min-height: inherit;
}

.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  color: var(--text-color-secondary);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
