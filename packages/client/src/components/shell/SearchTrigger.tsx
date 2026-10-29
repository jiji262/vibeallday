import { useI18n } from "../../i18n";
import { SearchIcon } from "../garden/icons";
import { Kbd } from "../garden/Kbd";
import { useCommandPalette } from "./CommandPaletteContext";
import styles from "./SearchTrigger.module.css";
import { isApplePlatform } from "./shortcut";

const SEARCH_ICON_SIZE = 14;
const APPLE_SHORTCUT_LABEL = "⌘K";

/** Top-bar entry to the command palette; absent outside the app shell. */
export function SearchTrigger() {
  const palette = useCommandPalette();
  const { t } = useI18n();
  if (!palette) return null;
  const shortcut = isApplePlatform() ? APPLE_SHORTCUT_LABEL : t("kbdCtrlK");
  return (
    <button
      type="button"
      className={styles.trigger}
      onClick={palette.open}
      aria-label={t("searchTriggerAria")}
      aria-keyshortcuts={isApplePlatform() ? "Meta+K" : "Control+K"}
      aria-haspopup="dialog"
    >
      <SearchIcon size={SEARCH_ICON_SIZE} className={styles.icon} />
      <span className={styles.label}>{t("searchTriggerLabel")}</span>
      <Kbd className={styles.kbd}>{shortcut}</Kbd>
    </button>
  );
}
