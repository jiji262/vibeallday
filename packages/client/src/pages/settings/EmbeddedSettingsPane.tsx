import type { ReactNode } from "react";
import styles from "./EmbeddedSettingsPane.module.css";
import { SettingsPaneTitleProvider } from "./SettingsPaneTitleContext";
import { useSettingsSearchScope } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";
import {
  type SettingsUndoRegistration,
  SettingsUndoProvider,
} from "./SettingsUndoContext";

const noopSetPaneTitle = (_title: string | null) => {};
const noopSetUndoRegistration = (
  _registration: SettingsUndoRegistration | null,
) => {};

/**
 * Isolates pane-title and header-undo registrations for sections consolidated
 * into a host Settings category so they remain searchable and jumpable without
 * overwriting the host category's title or undo baseline.
 */
export function EmbeddedSettingsPane({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const inSearch = Boolean(useSettingsSearchScope());
  const inner = title ? (
    <SettingsSection
      title={title}
      className={inSearch ? undefined : styles.framedSection}
    >
      {children}
    </SettingsSection>
  ) : (
    children
  );
  const content = inSearch ? inner : <div className={styles.pane}>{inner}</div>;

  return (
    <SettingsPaneTitleProvider value={noopSetPaneTitle}>
      <SettingsUndoProvider value={noopSetUndoRegistration}>
        {content}
      </SettingsUndoProvider>
    </SettingsPaneTitleProvider>
  );
}
