import { useEffect, useState } from "react";
import { useCurrentSourceRuntime } from "../contexts/SourceRuntimeContext";
import { useI18n } from "../i18n";
import { FilterDropdown } from "./FilterDropdown";
import styles from "./MachineControlSessionSelection.module.css";

/**
 * Whether the installed Machine Control app can take a session. The form calls
 * this at mount, not the option itself: the option lives in a sheet that mounts
 * only while open, and a readiness read (and selection reset) tied to the
 * sheet would run on every open and lose the user's choice.
 */
export function useMachineControlAvailable(
  eligible: boolean,
  onReset: (selected: boolean) => void,
): boolean {
  const { transport } = useCurrentSourceRuntime();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let disposed = false;
    setAvailable(false);
    onReset(false);
    if (eligible)
      void transport
        .fetch<{ available: boolean }>("/machine-control")
        .then((status) => {
          if (!disposed) setAvailable(status.available === true);
        })
        .catch(() => {
          /* Optional readiness remains unavailable. */
        });
    return () => {
      disposed = true;
    };
  }, [transport, eligible, onReset]);
  return available;
}

export function MachineControlSessionSelection({
  eligible,
  available,
  selected,
  onChange,
  disabled = false,
  showCaption = false,
}: {
  eligible: boolean;
  available: boolean;
  selected: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  showCaption?: boolean;
}) {
  const { t } = useI18n();
  if (!eligible || !available) return null;
  return (
    <div className={`new-session-helper-section ${styles.section}`}>
      <h3>{t("newSessionMachineControlTitle")}</h3>
      <FilterDropdown<"off" | "on">
        label={t("newSessionMachineControlTitle")}
        options={[
          { value: "off", label: t("showThinkingOff"), disabled },
          { value: "on", label: t("showThinkingOn"), disabled },
        ]}
        selected={[selected ? "on" : "off"]}
        onChange={([value]) => {
          if (!disabled) onChange(value === "on");
        }}
        multiSelect={false}
        fullWidth
        triggerClassName={styles.leftAlignedTrigger}
      />
      {showCaption && (
        <p className={styles.caption}>{t("machineControlSessionScope")}</p>
      )}
    </div>
  );
}
