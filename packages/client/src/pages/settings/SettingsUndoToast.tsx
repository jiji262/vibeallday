import { useEffect, useRef } from "react";
import { useOptionalToastContext } from "../../contexts/ToastContext";
import { useI18n } from "../../i18n";
import type { SettingsUndoRegistration } from "./SettingsUndoContext";

/**
 * Offer Undo in a toast the moment a pane's first change makes it undoable
 * (and again after each undo, once a new change lands). The action calls the
 * same pane-snapshot undo as the header button, using the latest registration
 * so a later change is still reverted to the pane-open snapshot.
 */
export function useSettingsUndoToast(
  registration: SettingsUndoRegistration | null,
  paneTitle: string,
): void {
  const { t } = useI18n();
  const toast = useOptionalToastContext();
  const latest = useRef(registration);
  latest.current = registration;
  const canUndo = registration?.canUndo ?? false;
  const wasUndoable = useRef(canUndo);

  useEffect(() => {
    const becameUndoable = canUndo && !wasUndoable.current;
    wasUndoable.current = canUndo;
    if (!becameUndoable || !toast) return;
    toast.showToast(
      t("settingsUndoToastChanged", { page: paneTitle }),
      "info",
      {
        label: t("settingsUndoChanges"),
        onClick: () => void latest.current?.undo(),
      },
    );
  }, [canUndo, paneTitle, t, toast]);
}
