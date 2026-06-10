import { ref, computed } from "vue";

export interface BulkOperation<T> {
  id: string;
  label: string;
  icon: string;
  severity?: "primary" | "secondary" | "success" | "warning" | "danger";
  action: (items: T[]) => Promise<void>;
  confirmMessage?: string | ((count: number) => string);
}

export function useBulkOperations<T extends { id: number | string }>(options: {
  operations: BulkOperation<T>[];
  onSuccess?: (operation: string, count: number) => void;
  onError?: (operation: string, error: Error) => void;
}) {
  const selectedItems = ref<T[]>([]) as { value: T[] };
  const processing = ref(false);
  const currentOperation = ref<string | null>(null);

  const selectedCount = computed(() => selectedItems.value.length);
  const hasSelection = computed(() => selectedCount.value > 0);

  const selectedIds = computed(() =>
    selectedItems.value.map((item) => item.id),
  );

  function selectItem(item: T) {
    const index = selectedItems.value.findIndex((i) => i.id === item.id);
    if (index === -1) {
      selectedItems.value.push(item);
    }
  }

  function deselectItem(item: T) {
    const index = selectedItems.value.findIndex((i) => i.id === item.id);
    if (index !== -1) {
      selectedItems.value.splice(index, 1);
    }
  }

  function toggleItem(item: T) {
    const index = selectedItems.value.findIndex((i) => i.id === item.id);
    if (index === -1) {
      selectedItems.value.push(item);
    } else {
      selectedItems.value.splice(index, 1);
    }
  }

  function selectAll(items: T[]) {
    selectedItems.value = [...items];
  }

  function deselectAll() {
    selectedItems.value = [];
  }

  function isSelected(item: T): boolean {
    return selectedItems.value.some((i) => i.id === item.id);
  }

  async function executeOperation(operationId: string): Promise<boolean> {
    const operation = options.operations.find((op) => op.id === operationId);
    if (!operation || !hasSelection.value) return false;

    processing.value = true;
    currentOperation.value = operationId;

    try {
      await operation.action(selectedItems.value);
      options.onSuccess?.(operationId, selectedCount.value);
      deselectAll();
      return true;
    } catch (error) {
      options.onError?.(operationId, error as Error);
      return false;
    } finally {
      processing.value = false;
      currentOperation.value = null;
    }
  }

  function getConfirmMessage(operationId: string): string {
    const operation = options.operations.find((op) => op.id === operationId);
    if (!operation?.confirmMessage) {
      return `Are you sure you want to perform this action on ${selectedCount.value} item(s)?`;
    }

    if (typeof operation.confirmMessage === "function") {
      return operation.confirmMessage(selectedCount.value);
    }

    return operation.confirmMessage;
  }

  return {
    selectedItems,
    selectedCount,
    selectedIds,
    hasSelection,
    processing,
    currentOperation,
    operations: options.operations,
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    deselectAll,
    isSelected,
    executeOperation,
    getConfirmMessage,
  };
}
