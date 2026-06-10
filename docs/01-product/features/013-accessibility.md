# Feature: Accessibility

## What it does

Accessibility ensures Testoria is usable by people who rely on keyboard navigation, screen readers, or other assistive technologies. The feature covers: a skip navigation link to bypass repetitive header content, keyboard-navigable interactive elements, ARIA live region announcements for dynamic content changes, and focus trapping inside modal dialogs.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **All roles** | All accessibility features apply universally — not role-gated |

## Key behaviours

- **Skip link**: `SkipLink.vue` is the first focusable element in the DOM; activating it moves focus to the main content area, bypassing sidebar and header. Visible only when focused.
- **Keyboard navigation**: all interactive elements (buttons, links, form controls, table rows) are reachable via `Tab`/`Shift+Tab`. Custom interactive elements use `tabindex="0"` and respond to `Enter`/`Space`.
- **Screen reader announcements**: `useAccessibility` composable provides a `announce(message, politeness)` helper that writes to a visually hidden ARIA live region (`aria-live="polite"` or `aria-live="assertive"`). Used to announce async actions such as "Test result saved" or "Filter applied".
- **Focus trapping**: modal dialogs trap focus within their boundary — `Tab` cycles through focusable children only; `Escape` closes the dialog and returns focus to the trigger element. Implemented via `useAccessibility` or directly in `ConfirmDialog.vue`.
- **Roving tabindex**: complex widgets (e.g. the suite tree, result list) use roving tabindex patterns so the widget as a whole receives one tab stop and arrow keys move within it.
- **ARIA labels**: icon-only buttons carry `aria-label`; status badges use `aria-label` or `role="status"` for meaningful screen reader output.
- **Keyboard shortcuts**: `useKeyboardShortcuts(shortcuts: Record<string, () => void>)` registers app-wide key bindings. Key strings follow the format `ctrl+alt+shift+key` (lowercase, modifiers sorted). Shortcuts are suppressed when focus is inside INPUT, TEXTAREA, or a `contenteditable` element. Current built-in shortcuts: `?` opens the keyboard shortcuts help dialog.
- **Keyboard shortcuts dialog**: `KeyboardShortcutsDialog.vue` lists all registered shortcuts. Open via `?` key or the `pi-question-circle` button in the app header.
- **`data-testid` attributes**: critical interactive elements carry `data-testid` for stable e2e test targeting. Convention: `<feature>-<element>`. See `docs/03-engineering/testing/e2e.md` for the full list.

## Constraints / edge cases

- PrimeVue 4 components have built-in accessibility support — avoid overriding their ARIA attributes unless strictly necessary.
- Custom `RichTextEditor.vue` (Tiptap) has limited screen reader support; Tiptap's accessibility is constrained by its contenteditable approach.
- ARIA live region announcements should be **debounced** for rapid successive changes (e.g. filtering a large list) to avoid flooding screen readers.
- Focus trapping in `ConfirmDialog.vue` must be deactivated when the dialog closes — failure to do so will trap all subsequent focus in a disconnected element.
- The `useAccessibility` composable must be initialised once at the app level (mounts the live region DOM node) — calling it in multiple components is safe because it checks for an existing node before creating one.
- Test coverage for accessibility is primarily via Playwright e2e tests using keyboard-only interaction flows — see `docs/03-engineering/testing/e2e.md`.

## Related docs

- `src/composables/useAccessibility.ts`
- `src/components/common/KeyboardShortcutsDialog.vue`
- `src/components/common/AppHeader.vue` — `?` key handler and help button
- `src/components/common/SkipLink.vue`
- `src/components/common/ConfirmDialog.vue`
- `docs/03-engineering/testing/e2e.md` — accessibility e2e test patterns
- `docs/07-references/llm/design-system.txt` — PrimeVue accessibility defaults
