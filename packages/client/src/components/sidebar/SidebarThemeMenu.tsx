import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { THEMES, type Theme, useTheme } from "../../hooks/useTheme";
import { useI18n } from "../../i18n";
import { getThemeLabel } from "../../i18n-settings";
import { CheckIcon } from "../garden/icons";
import { Menu, MenuItem } from "../garden/Menu";
import styles from "./SidebarChrome.module.css";

const ICON_SIZE = 18;
const CHECK_SIZE = 14;
/** Gap between the trigger and the menu panel, in px. */
const MENU_GAP = 6;
/** Minimum distance kept from the viewport edges, in px. */
const VIEWPORT_MARGIN = 8;

/** Half-filled disc (design 切换界面风格 glyph). */
function ContrastIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

/** Opens upward from the footer, clamped inside the viewport. */
function menuPosition(anchor: DOMRect) {
  return {
    left: Math.max(VIEWPORT_MARGIN, anchor.left),
    bottom: Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - anchor.top + MENU_GAP,
    ),
  };
}

interface ThemeMenuPanelProps {
  anchor: DOMRect;
  current: Theme;
  onPick: (theme: Theme) => void;
  onClose: () => void;
}

function ThemeMenuPanel({
  anchor,
  current,
  onPick,
  onClose,
}: ThemeMenuPanelProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = menuRef.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    selected?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        className={styles.menuOverlay}
        aria-label={t("modalClose")}
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className={styles.themeMenu}
        style={menuPosition(anchor)}
      >
        <Menu label={t("shellNavThemeMenu")}>
          {THEMES.map((theme) => (
            <MenuItem
              key={theme}
              aria-current={theme === current ? "true" : undefined}
              trailing={
                theme === current ? <CheckIcon size={CHECK_SIZE} /> : undefined
              }
              onClick={() => onPick(theme)}
            >
              {getThemeLabel(theme, t)}
            </MenuItem>
          ))}
        </Menu>
      </div>
    </>,
    document.body,
  );
}

/**
 * Footer appearance control: a four-option menu over the existing theme ids
 * (auto, light, dark, verydark). The choice applies immediately.
 */
export function SidebarThemeMenu() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const close = useCallback(() => {
    setAnchor(null);
    buttonRef.current?.focus();
  }, []);
  const pick = useCallback(
    (next: Theme) => {
      setTheme(next);
      close();
    },
    [close, setTheme],
  );
  const toggle = () =>
    setAnchor((open) =>
      open ? null : (buttonRef.current?.getBoundingClientRect() ?? null),
    );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`sidebar-theme-toggle ${styles.iconButton}`}
        aria-label={t("shellNavThemeButton")}
        title={t("shellNavThemeButton")}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={toggle}
      >
        <ContrastIcon />
      </button>
      {anchor ? (
        <ThemeMenuPanel
          anchor={anchor}
          current={theme}
          onPick={pick}
          onClose={close}
        />
      ) : null}
    </>
  );
}
