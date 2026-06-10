import { ref, onMounted, onUnmounted } from "vue";

/**
 * Accessibility composable for enhanced keyboard navigation and screen reader support
 */
export function useAccessibility() {
  const isKeyboardUser = ref(false);

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Tab") {
      isKeyboardUser.value = true;
      document.body.classList.add("keyboard-user");
    }
  }

  function handleMousedown() {
    isKeyboardUser.value = false;
    document.body.classList.remove("keyboard-user");
  }

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("mousedown", handleMousedown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
    document.removeEventListener("mousedown", handleMousedown);
  });

  /**
   * Announce message to screen readers
   */
  function announce(
    message: string,
    priority: "polite" | "assertive" = "polite",
  ) {
    const announcer =
      document.getElementById("sr-announcer") || createAnnouncer();
    announcer.setAttribute("aria-live", priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = "";
    }, 1000);
  }

  function createAnnouncer(): HTMLElement {
    const announcer = document.createElement("div");
    announcer.id = "sr-announcer";
    announcer.setAttribute("aria-live", "polite");
    announcer.setAttribute("aria-atomic", "true");
    announcer.className = "sr-only";
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announcer);
    return announcer;
  }

  /**
   * Focus trap for modals and dialogs
   */
  function createFocusTrap(container: HTMLElement) {
    const focusableSelectors = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const focusableElements =
      container.querySelectorAll<HTMLElement>(focusableSelectors);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    function handleTrapKeydown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    container.addEventListener("keydown", handleTrapKeydown);

    // Focus first element
    firstFocusable?.focus();

    return () => {
      container.removeEventListener("keydown", handleTrapKeydown);
    };
  }

  /**
   * Skip link functionality
   */
  function skipToContent(targetId: string) {
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus();
      target.removeAttribute("tabindex");
    }
  }

  /**
   * Generate unique ID for accessibility attributes
   */
  function generateId(prefix = "a11y"): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  return {
    isKeyboardUser,
    announce,
    createFocusTrap,
    skipToContent,
    generateId,
  };
}

/**
 * Keyboard shortcuts composable
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  function handleKeydown(event: KeyboardEvent) {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    const key = [
      event.ctrlKey && "ctrl",
      event.altKey && "alt",
      event.shiftKey && "shift",
      event.key.toLowerCase(),
    ]
      .filter(Boolean)
      .join("+");

    if (shortcuts[key]) {
      event.preventDefault();
      shortcuts[key]();
    }
  }

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
}
