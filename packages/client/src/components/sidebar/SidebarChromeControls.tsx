import { useI18n } from "../../i18n";
import { SearchIcon } from "../garden/icons";
import { Kbd } from "../garden/Kbd";
import { useCommandPalette } from "../shell/CommandPaletteContext";
import { isApplePlatform } from "../shell/shortcut";
import { SIDEBAR_ICON_SIZE, SidebarNavItem } from "../SidebarNavItem";
import styles from "./SidebarChrome.module.css";
import { SidebarThemeMenu } from "./SidebarThemeMenu";
import { ReturnToSuperuserButton } from "./SidebarNavGroups";
import { destinationsInGroup, useShellDestinations } from "./shellDestinations";

const SEARCH_ICON_SIZE = 16;
const APPLE_SHORTCUT_LABEL = "⌘K";

interface SidebarChromeProps {
  basePath: string;
  onNavigate: () => void;
}

/**
 * Secondary 搜索或跳转 action under New Session. It opens the shell's command
 * palette (closing the drawer first); outside the shell there is none.
 */
export function SidebarSearchButton({
  onNavigate,
}: Pick<SidebarChromeProps, "onNavigate">) {
  const palette = useCommandPalette();
  const { t } = useI18n();
  if (!palette) return null;
  const apple = isApplePlatform();
  const label = t("shellNavSearch");
  return (
    <button
      type="button"
      className={`sidebar-nav-item ${styles.search}`}
      onClick={() => {
        onNavigate();
        palette.open();
      }}
      aria-label={label}
      title={label}
      aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
      aria-haspopup="dialog"
    >
      <SearchIcon size={SEARCH_ICON_SIZE} className={styles.searchIcon} />
      <span className={`sidebar-nav-text ${styles.searchLabel}`}>{label}</span>
      <Kbd className={`sidebar-nav-text ${styles.searchKbd}`}>
        {apple ? APPLE_SHORTCUT_LABEL : t("kbdCtrlK")}
      </Kbd>
    </button>
  );
}

/** Footer: Settings, the appearance menu and a switched superuser's exit. */
export function SidebarFooter({ basePath, onNavigate }: SidebarChromeProps) {
  const { t } = useI18n();
  const system = destinationsInGroup(useShellDestinations(), "system");
  return (
    <div className={styles.footer}>
      <div className={styles.footerRow}>
        {system.map((destination) => (
          <SidebarNavItem
            key={destination.key}
            to={destination.to}
            icon={<destination.Icon size={SIDEBAR_ICON_SIZE} />}
            label={t(destination.labelKey)}
            onClick={onNavigate}
            basePath={basePath}
            className={styles.footerItem}
          />
        ))}
        <SidebarThemeMenu />
      </div>
      <ReturnToSuperuserButton />
    </div>
  );
}
