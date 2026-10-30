import { useId } from "react";
import { StatusDot } from "../../components/garden/StatusDot";
import type { Theme } from "../../hooks/useTheme";
import { type MessageKey, useI18n } from "../../i18n";
import { getThemeLabel } from "../../i18n-settings";
import styles from "./AppearanceSettings.module.css";
import { SettingsItem } from "./SettingsItem";

/** Design order: Celadon, Night, Night · OLED, then System. */
const SKIN_ORDER: readonly Theme[] = ["light", "dark", "verydark", "auto"];

const SKIN_DESCRIPTION_KEY: Record<Theme, MessageKey> = {
  light: "settingsLookSkinCeladonDesc",
  dark: "settingsLookSkinNightDesc",
  verydark: "settingsLookSkinOledDesc",
  auto: "settingsLookSkinAutoDesc",
};

/**
 * Miniature app frame painted with one skin's tokens: the `data-theme`
 * attribute re-scopes the theme.css token blocks onto this subtree only.
 */
function SkinFrame({ skin, compact }: { skin: Theme; compact?: boolean }) {
  return (
    <span className={styles.skinFrame} data-theme={skin}>
      {compact ? null : (
        <span className={styles.skinSide}>
          <span className={`${styles.skinBar} ${styles.skinBarOn}`} />
          <span className={styles.skinBar} />
          <span className={`${styles.skinBar} ${styles.skinBarShort}`} />
        </span>
      )}
      <span className={styles.skinMain}>
        <span className={styles.skinCard}>
          <StatusDot state="attn" />
          <span className={styles.skinBar} />
        </span>
        <span className={styles.skinCard}>
          <StatusDot state="run" />
          <span className={styles.skinBar} />
        </span>
        <span className={styles.skinButton} />
      </span>
    </span>
  );
}

function SkinThumb({ skin }: { skin: Theme }) {
  if (skin === "auto") {
    return (
      <span className={styles.skinThumb} aria-hidden="true">
        <SkinFrame skin="light" compact />
        <SkinFrame skin="dark" compact />
      </span>
    );
  }
  return (
    <span className={styles.skinThumb} aria-hidden="true">
      <SkinFrame skin={skin} />
    </span>
  );
}

interface SkinCardProps {
  skin: Theme;
  selected: boolean;
  onSelect: (skin: Theme) => void;
}

function SkinCard({ skin, selected, onSelect }: SkinCardProps) {
  const { t } = useI18n();
  const id = useId();
  const translate = (key: string) => t(key as never);
  return (
    <button
      type="button"
      className={styles.skinCardButton}
      aria-pressed={selected}
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-desc`}
      data-skin={skin}
      onClick={() => onSelect(skin)}
    >
      <SkinThumb skin={skin} />
      <span className={styles.skinText}>
        <span id={`${id}-name`} className={styles.skinName}>
          {getThemeLabel(skin, translate)}
        </span>
        <span id={`${id}-desc`} className={styles.skinDescription}>
          {t(SKIN_DESCRIPTION_KEY[skin])}
        </span>
      </span>
    </button>
  );
}

/**
 * Skin picker: four preview cards (aria-pressed) mapping to the existing
 * theme ids. Searchable as the Theme row; switching applies immediately.
 */
export function AppearanceSkinPicker({
  theme,
  onSelect,
}: {
  theme: Theme;
  onSelect: (skin: Theme) => void;
}) {
  const { t } = useI18n();
  const translate = (key: string) => t(key as never);
  return (
    <SettingsItem
      label={t("appearanceThemeTitle")}
      keywords={["skin", "dark", "light", "oled", "celadon", "night"]}
      valueText={getThemeLabel(theme, translate)}
      layout="custom"
      baseClassName={styles.skinRow}
    >
      <p className={styles.skinHint}>{t("settingsLookSkinHint")}</p>
      <div
        className={styles.skinGrid}
        role="group"
        aria-label={t("appearanceThemeTitle")}
      >
        {SKIN_ORDER.map((skin) => (
          <SkinCard
            key={skin}
            skin={skin}
            selected={theme === skin}
            onSelect={onSelect}
          />
        ))}
      </div>
    </SettingsItem>
  );
}
