import type { ReactNode } from "react";
import { ScopeTag, type SettingScope } from "../../components/garden/ScopeTag";
import { useI18n } from "../../i18n";
import styles from "./PerformanceSettings.module.css";
import { ScopeHint, SettingsItem } from "./SettingsItem";

interface ToggleSettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Overrides the section's storage scope (e.g. a server setting). */
  scope?: SettingScope;
  keywords?: string[];
  after?: ReactNode;
  /** Custom info block (e.g. a title with an extra tag). */
  info?: ReactNode;
}

/** One on/off settings row (shared by the data panes) with its On/Off value. */
export function ToggleSettingRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  scope,
  keywords,
  after,
  info,
}: ToggleSettingRowProps) {
  const { t } = useI18n();
  return (
    <SettingsItem
      label={label}
      description={description}
      valueText={t(checked ? "commonOn" : "commonOff")}
      scope={scope}
      keywords={keywords}
      after={after}
      info={info}
    >
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={label}
        />
        <span className="toggle-slider" />
      </label>
    </SettingsItem>
  );
}

interface PerformanceValueControlProps {
  /** Current value chip (design `.pf-val`); omitted for steppers. */
  value?: ReactNode;
  /** Range and default, shown under the control. */
  hint: string;
  children: ReactNode;
}

/** Slider or stepper with its value chip and a range/default hint below. */
export function PerformanceValueControl({
  value,
  hint,
  children,
}: PerformanceValueControlProps) {
  return (
    <div className={`settings-item-actions ${styles.control}`}>
      <div className={styles.controlRow}>
        {children}
        {value !== undefined && (
          <output className={styles.value}>{value}</output>
        )}
      </div>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}

/**
 * Custom-info title that keeps the row's storage scope tag; the tag stays out
 * of the accessible name and ScopeHint after the title speaks it instead.
 */
export function ScopedRowTitle({
  label,
  scope,
  tag,
}: {
  label: string;
  scope: SettingScope;
  /** Extra tag between the title and the scope (e.g. Experimental). */
  tag?: ReactNode;
}) {
  return (
    <>
      <strong>
        <span>{label}</span>
        {tag && <span className={styles.scopeTag}>{tag}</span>}
        <span aria-hidden="true" className={styles.scopeTag}>
          <ScopeTag scope={scope} />
        </span>
      </strong>
      <ScopeHint scope={scope} />
    </>
  );
}
