import { describe, it, expect } from "vitest";
import { computeNewOrder, REORDER_GAP } from "@/composables/useTreeDnd";

interface Item {
  id: number;
  display_order: number | null;
}

const items = (orders: Array<number | null>): Item[] =>
  orders.map((display_order, i) => ({ id: i + 1, display_order }));

describe("computeNewOrder", () => {
  it("dropping above the first item shifts to first_order - GAP", () => {
    const list = items([100, 200, 300]);
    // Drag item #3 (300) above item #1 (100)
    const order = computeNewOrder(list, 3, 1, "above");
    expect(order).toBe(100 - REORDER_GAP);
  });

  it("dropping below the last item shifts to last_order + GAP", () => {
    const list = items([100, 200, 300]);
    // Drag item #1 (100) below item #3 (300)
    const order = computeNewOrder(list, 1, 3, "below");
    expect(order).toBe(300 + REORDER_GAP);
  });

  it("dropping between two items bisects integer midpoint", () => {
    const list = items([100, 200, 300]);
    // Drag item #1 (100) above item #3 (300)
    // Siblings (excluding dragged): [#2(200), #3(300)]; insert at index 1 → between 200 and 300
    const order = computeNewOrder(list, 1, 3, "above");
    expect(order).toBe(250);
  });

  it("collapses to prev+1 when the bisect midpoint equals prev", () => {
    const list = items([5, 6, 7]);
    // Siblings without #1: [#2(6), #3(7)]; insert above #3 → between 6 and 7 → floor((6+7)/2) = 6 (== prev)
    const order = computeNewOrder(list, 1, 3, "above");
    expect(order).toBe(7);
  });

  it("ignores the dragged item's old position when picking neighbours", () => {
    // #2 is the dragged item; should be excluded from the sibling list
    const list = items([100, 200, 300]);
    // Drag #2 (200) below #3 (300) → after dragged is removed siblings are [#1, #3]
    // Insert at end → 300 + GAP
    const order = computeNewOrder(list, 2, 3, "below");
    expect(order).toBe(300 + REORDER_GAP);
  });

  it("returns null when dropping a row onto itself", () => {
    const list = items([100, 200]);
    expect(computeNewOrder(list, 1, 1, "above")).toBeNull();
  });

  it("returns null for a no-op drop adjacent to the source", () => {
    const list = items([100, 200, 300]);
    // Drag #2 above #3 — adjacency below #2 means this is a no-op
    expect(computeNewOrder(list, 2, 3, "above")).toBeNull();
  });

  it("handles NULL display_order neighbours by treating them as missing", () => {
    const list = items([null, null, 50]);
    // Drag #1 above #3 → siblings [#2(null), #3(50)]; insert at index 1 (above #3) → prev = #2(null), next = #3(50) → 50 - GAP
    const order = computeNewOrder(list, 1, 3, "above");
    expect(order).toBe(50 - REORDER_GAP);
  });

  it("seeds with GAP when the only sibling has no display_order", () => {
    const list = items([null, null]);
    // Drag #2 above #1; siblings [#1(null)]; insert at index 0 → next = #1(null) → falls through to gap default
    const order = computeNewOrder(list, 2, 1, "above");
    expect(order).toBe(REORDER_GAP);
  });
});
