import { useCallback, useEffect, useRef, useState } from "react";
import { writeClipboardText } from "../../lib/clipboard";

/** How long a copy control shows its confirmation state. */
export const COPY_FEEDBACK_MS = 2000;

/**
 * Copy `text` and report success for `resetMs`. Returns whether the last copy
 * succeeded, so callers can log or toast a failure.
 */
export function useCopyFeedback(text: string, resetMs = COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    const success = await writeClipboardText(text);
    if (!success) return false;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCopied(false);
    }, resetMs);
    return true;
  }, [resetMs, text]);

  return { copied, copy };
}
