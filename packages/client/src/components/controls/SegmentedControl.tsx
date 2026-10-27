import type { ReactNode } from "react";
import styles from "./SegmentedControl.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when the visible label is not enough. */
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology. */
  label: string;
  options: readonly SegmentedOption<T>[];
  /** `null` means no segment is chosen, as in a pair that may both be off. */
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Equal-width toggle buttons in one rounded track. Each segment is a 40px
 * button, 44px on touch; the chosen one carries `aria-pressed`.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${styles.track}${className ? ` ${className}` : ""}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.segment}
          aria-pressed={value === option.value}
          aria-label={option.ariaLabel}
          title={option.title}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
