import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";
import styles from "./Menu.module.css";

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

const NEXT_KEY = "ArrowDown";
const PREVIOUS_KEY = "ArrowUp";

function targetIndex(key: string, current: number, count: number) {
  if (key === NEXT_KEY) return (current + 1) % count;
  if (key === PREVIOUS_KEY) return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** Up/Down move between enabled items (wrapping); Home/End jump. */
function moveItemFocus(event: KeyboardEvent<HTMLDivElement>) {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not(:disabled)',
    ),
  );
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLElement);
  const next = targetIndex(event.key, Math.max(current, 0), items.length);
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
}

interface MenuProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the menu for assistive technology. */
  label: string;
  children: ReactNode;
}

/**
 * Menu panel (design .menu). It owns item styling and arrow-key movement;
 * the popover or sheet around it owns placement, Escape and focus return.
 */
export function Menu({
  label,
  children,
  className,
  onKeyDown,
  ...rest
}: MenuProps) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={join(styles.menu, className)}
      onKeyDown={(event) => {
        moveItemFocus(event);
        onKeyDown?.(event);
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  /** Trailing hint such as a shortcut (`Kbd`) or a count. */
  trailing?: ReactNode;
  tone?: "default" | "danger";
}

/** A 36px row (48px on phones and touch). */
export function MenuItem({
  icon,
  trailing,
  tone = "default",
  className,
  children,
  type = "button",
  ...rest
}: MenuItemProps) {
  return (
    <button
      type={type}
      role="menuitem"
      className={join(
        styles.item,
        tone === "danger" && styles.danger,
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className={styles.separator} />;
}

/** Group caption; decorative, so name the group with `role="group"` too. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className={styles.groupLabel} aria-hidden="true">
      {children}
    </div>
  );
}
