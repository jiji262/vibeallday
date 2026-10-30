import { useEffect, useRef } from "react";

export interface TriageShortcutHandlers {
  /** S: skip the current item; omitted when nothing is left. */
  onSkip?: () => void;
  /** Esc: leave triage. */
  onExit: () => void;
}

/** Typing targets keep every key; single-letter shortcuts stay inert. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])')
  ) {
    return true;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

/** Page-level S / Esc for triage, ignored while focus is in a text field. */
export function useTriageShortcuts(handlers: TriageShortcutHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (hasModifier(event) || isEditableTarget(event.target)) return;
      const { onSkip, onExit } = latest.current;
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      } else if (event.key.toLowerCase() === "s" && onSkip) {
        event.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
