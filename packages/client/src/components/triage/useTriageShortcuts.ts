import { useEffect, useRef } from "react";

export interface TriageShortcutHandlers {
  /** S: skip the current item; omitted when nothing is left. */
  onSkip?: () => void;
  /** Esc: leave triage. */
  onExit: () => void;
  /** A: approve the current request once; omitted when it cannot be. */
  onApprove?: () => void;
  /** D: start denying the current request (asks for a reason). */
  onDeny?: () => void;
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

/** The handler a letter key maps to, if any is available now. */
function letterHandler(
  key: string,
  handlers: TriageShortcutHandlers,
): (() => void) | undefined {
  switch (key.toLowerCase()) {
    case "s":
      return handlers.onSkip;
    case "a":
      return handlers.onApprove;
    case "d":
      return handlers.onDeny;
    default:
      return undefined;
  }
}

/**
 * Page-level A / D / S / Esc for triage, ignored while focus is in a text
 * field. A held key never repeats: approving must take one press per item.
 */
export function useTriageShortcuts(handlers: TriageShortcutHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (hasModifier(event) || isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        latest.current.onExit();
        return;
      }
      const handler = letterHandler(event.key, latest.current);
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
