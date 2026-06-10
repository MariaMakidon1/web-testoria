import { ref, computed, type Ref } from "vue";

export const REORDER_GAP = 1000;

export interface DndSibling {
  id: number;
  display_order?: number | null;
}

export type DropPosition = "above" | "below";

interface DragState {
  draggedId: number | null;
  overId: number | null;
  position: DropPosition | null;
}

export interface UseTreeDndOptions<T extends DndSibling> {
  /** Items in current render order — used to pick neighbours for gap math. */
  items: Ref<T[]>;
  /**
   * Key that groups items into a drag scope. v1 rejects drops across scopes.
   * For suites: `parent_suite_id ?? 0`. For cases: `suite_id`.
   */
  scopeKey: (item: T) => string | number;
  /**
   * Fired once per accepted drop with the new `display_order` for `draggedId`.
   * The caller persists the change via its store action.
   */
  onReorder: (draggedId: number, newDisplayOrder: number) => void;
}

/**
 * Gap-based ordering: returns a new `display_order` that places `draggedId`
 * at the requested slot inside `items`. Caller has already vetted that the
 * drag and drop targets share a scope. Returns `null` when the requested
 * placement is a no-op (e.g. dropping an item onto itself).
 */
export function computeNewOrder<T extends DndSibling>(
  items: T[],
  draggedId: number,
  overId: number,
  position: DropPosition,
  gap = REORDER_GAP,
): number | null {
  if (draggedId === overId) return null;

  const overIndex = items.findIndex((it) => it.id === overId);
  if (overIndex === -1) return null;

  // The position of the drop slot relative to `items`, ignoring the dragged row.
  const draggedIndex = items.findIndex((it) => it.id === draggedId);
  const siblings = items.filter((it) => it.id !== draggedId);
  const overInSiblings = siblings.findIndex((it) => it.id === overId);
  if (overInSiblings === -1) return null;

  // A drop directly adjacent to the source position is a no-op.
  if (draggedIndex !== -1) {
    if (position === "above" && draggedIndex === overIndex - 1) return null;
    if (position === "below" && draggedIndex === overIndex + 1) return null;
  }

  const insertIndex =
    position === "above" ? overInSiblings : overInSiblings + 1;
  const prev = insertIndex > 0 ? siblings[insertIndex - 1] : null;
  const next = insertIndex < siblings.length ? siblings[insertIndex] : null;

  const prevOrder = prev?.display_order ?? null;
  const nextOrder = next?.display_order ?? null;

  if (prevOrder !== null && nextOrder !== null) {
    const mid = Math.floor((prevOrder + nextOrder) / 2);
    // Collision on a tight gap → bias forward by one; rebalance is tech-debt.
    return mid === prevOrder ? prevOrder + 1 : mid;
  }
  if (prevOrder !== null) return prevOrder + gap;
  if (nextOrder !== null) return nextOrder - gap;
  return gap;
}

export function useTreeDnd<T extends DndSibling>(opts: UseTreeDndOptions<T>) {
  const state = ref<DragState>({
    draggedId: null,
    overId: null,
    position: null,
  });

  function reset() {
    state.value = { draggedId: null, overId: null, position: null };
  }

  function onDragStart(event: DragEvent, item: T) {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      // Required for Firefox to start the drag at all.
      event.dataTransfer.setData("text/plain", String(item.id));
    }
    state.value = { draggedId: item.id, overId: null, position: null };
  }

  function isSameScope(targetItem: T): boolean {
    const draggedItem = opts.items.value.find(
      (it) => it.id === state.value.draggedId,
    );
    if (!draggedItem) return false;
    return opts.scopeKey(draggedItem) === opts.scopeKey(targetItem);
  }

  function onDragOver(event: DragEvent, item: T) {
    if (state.value.draggedId === null || state.value.draggedId === item.id) {
      return;
    }
    if (!isSameScope(item)) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    state.value = {
      draggedId: state.value.draggedId,
      overId: item.id,
      position: event.clientY < midpoint ? "above" : "below",
    };
  }

  function onDragLeave(item: T) {
    if (state.value.overId === item.id) {
      state.value = { ...state.value, overId: null, position: null };
    }
  }

  function onDrop(event: DragEvent, item: T) {
    event.preventDefault();
    const draggedId = state.value.draggedId;
    const position = state.value.position;
    const wasSameScope = isSameScope(item);
    reset();
    if (draggedId === null || position === null || !wasSameScope) return;

    const newOrder = computeNewOrder(
      opts.items.value,
      draggedId,
      item.id,
      position,
    );
    if (newOrder === null) return;
    opts.onReorder(draggedId, newOrder);
  }

  function onDragEnd() {
    reset();
  }

  function dropIndicatorFor(item: T): "top" | "bottom" | null {
    if (state.value.overId !== item.id || state.value.position === null) {
      return null;
    }
    return state.value.position === "above" ? "top" : "bottom";
  }

  const draggedId = computed(() => state.value.draggedId);

  return {
    draggedId,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    dropIndicatorFor,
  };
}
