import type { ReactNode } from "react";
import styles from "./Kbd.module.css";

/** Keyboard hint chip, e.g. "⌘K" or "Esc". */
export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd className={className ? `${styles.kbd} ${className}` : styles.kbd}>
      {children}
    </kbd>
  );
}
