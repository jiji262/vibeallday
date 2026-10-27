import { useId } from "react";
import { UI_FONT_SCALE_PRESETS, useFontSize } from "../../hooks/useFontSize";
import { THEMES, type Theme, useTheme } from "../../hooks/useTheme";
import { useI18n } from "../../i18n";
import { getThemeLabel } from "../../i18n-settings";
import styles from "./SettingsQuickControls.module.css";

type UiFontPreset = (typeof UI_FONT_SCALE_PRESETS)[number];

const FONT_PRESET_KEY = {
  85: "fontSizeSmall",
  100: "fontSizeDefault",
  115: "fontSizeLarge",
  130: "fontSizeLarger",
} as const satisfies Record<UiFontPreset, string>;

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onSelect: (value: T) => void;
  /** Mono text shown beside the label, e.g. the exact percentage. */
  detail?: string;
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onSelect,
  detail,
}: SegmentedProps<T>) {
  const labelId = useId();
  return (
    <div className={styles.row}>
      <div className={styles.head}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {detail ? <span className={styles.detail}>{detail}</span> : null}
      </div>
      <div className={styles.segmented} role="group" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.option}${option.value === value ? ` ${styles.selected}` : ""}`}
            aria-pressed={option.value === value}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Theme and text size at the top of Settings; the full set lives in Appearance. */
export function SettingsQuickControls() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { fontSizePercent, setFontSizePercent } = useFontSize();
  const themeOptions = THEMES.map((value) => ({
    value,
    label: getThemeLabel(value, (key) => t(key as never)),
  }));
  const sizeOptions = UI_FONT_SCALE_PRESETS.map((value) => ({
    value,
    label: t(FONT_PRESET_KEY[value]),
  }));
  const onPreset = (value: number) => setFontSizePercent(value);
  return (
    <section className={styles.card} aria-label={t("settingsQuickAria")}>
      <Segmented<Theme>
        label={t("appearanceThemeTitle")}
        value={theme}
        options={themeOptions}
        onSelect={setTheme}
      />
      <Segmented<number>
        label={t("settingsQuickTextSize")}
        value={fontSizePercent}
        options={sizeOptions}
        onSelect={onPreset}
        detail={`${fontSizePercent}%`}
      />
    </section>
  );
}
