import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** Trailing count or Badge. */
  badge?: ReactNode;
  disabled?: boolean;
}

interface TabsProps<T extends string> {
  /** Names the tab list for assistive technology. */
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Class for a tab drawn by another element, such as a router link. */
export function tabClassName(active: boolean, className?: string): string {
  return [styles.tab, active ? styles.active : "", className]
    .filter(Boolean)
    .join(" ");
}

/** The underline strip; wrap `tabClassName` links in it for link tabs. */
export function TabList({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className ? `${styles.list} ${className}` : styles.list}
      {...rest}
    >
      {children}
    </div>
  );
}

const KEY_STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/** Arrow keys move between tabs (wrapping), Home/End jump; focus selects. */
function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not(:disabled)',
    ),
  );
  const current = tabs.indexOf(event.target as HTMLButtonElement);
  if (current < 0 || tabs.length === 0) return;
  let next: number | null = null;
  if (event.key in KEY_STEP) {
    next = (current + (KEY_STEP[event.key] ?? 0) + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = tabs.length - 1;
  }
  if (next === null) return;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}

/** Button tabs that switch local state. */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <TabList
      role="tablist"
      aria-label={label}
      className={className}
      onKeyDown={moveTabFocus}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={tabClassName(active)}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </TabList>
  );
}
