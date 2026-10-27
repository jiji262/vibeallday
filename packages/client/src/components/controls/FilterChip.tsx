import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./FilterChip.module.css";

interface FilterChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
}

/**
 * Pill-shaped toggle. The button keeps a 44px hit area around a 32px face, so
 * a row of chips reads as light as text yet stays easy to tap.
 */
export function FilterChip({
  pressed,
  onClick,
  children,
  disabled,
  title,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip}${className ? ` ${className}` : ""}`}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className={styles.face}>{children}</span>
    </button>
  );
}

interface CheckChipProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  children: ReactNode;
  hint?: ReactNode;
  title?: string;
}

/**
 * A real checkbox drawn as a chip. The native input stays in the tree, spread
 * over the chip, so keyboard, screen readers and click targets behave as for
 * any checkbox.
 */
export function CheckChip({ children, hint, title, ...input }: CheckChipProps) {
  return (
    <label className={styles.checkChip} title={title}>
      <input type="checkbox" className={styles.checkInput} {...input} />
      <span className={styles.face}>
        <span className={styles.tick} aria-hidden="true">
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </span>
        {children}
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
    </label>
  );
}
