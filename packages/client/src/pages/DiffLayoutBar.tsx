import {
  Segmented,
  type SegmentedOption,
} from "../components/garden/Segmented";
import type { TranslationFn } from "../i18n";
import type { DiffViewMode } from "../lib/diffSideBySide";
import styles from "./DiffLayoutBar.module.css";

/**
 * Design diff options row: the layout choice as a segmented track under the
 * diff header. `auto` stays a choice so a device can return to measuring.
 */
export function DiffLayoutBar({
  mode,
  onChange,
  t,
}: {
  mode: DiffViewMode;
  onChange: (mode: DiffViewMode) => void;
  t: TranslationFn;
}) {
  const options: SegmentedOption<DiffViewMode>[] = [
    { value: "auto", label: t("diffViewModeAuto") },
    { value: "unified", label: t("diffViewModeUnified") },
    { value: "side-by-side", label: t("diffViewModeSideBySide") },
  ];
  return (
    <div className={styles.bar}>
      <Segmented
        label={t("diffViewModeLabel")}
        options={options}
        value={mode}
        onChange={onChange}
        className={styles.layout}
      />
    </div>
  );
}
