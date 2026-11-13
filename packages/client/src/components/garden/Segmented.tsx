import type { KeyboardEvent, ReactNode } from "react";
import styles from "./Segmented.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  /** Names the radio group for assistive technology. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stretch to the container width, options sharing it equally. */
  block?: boolean;
  className?: string;
}

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

function stepFor(key: string, current: number, count: number): number | null {
  if (NEXT_KEYS.has(key)) return (current + 1) % count;
  if (PREVIOUS_KEYS.has(key)) return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** Radio semantics: arrows move focus and select, wrapping at the ends. */
function moveSelection(event: KeyboardEvent<HTMLDivElement>) {
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)',
    ),
  );
  const current = radios.indexOf(event.target as HTMLButtonElement);
  if (current < 0) return;
  const next = stepFor(event.key, current, radios.length);
  if (next === null) return;
  event.preventDefault();
  radios[next]?.focus();
  radios[next]?.click();
}

/** The option that holds the group's single tab stop. */
function tabStopValue<T extends string>(
  options: readonly SegmentedOption<T>[],
  value: T,
): T | undefined {
  const selected = options.find((option) => option.value === value);
  if (selected && !selected.disabled) return selected.value;
  return options.find((option) => !option.disabled)?.value;
}

/**
 * Segmented control (design .seg): a radiogroup with one tab stop (roving
 * tabindex). Use it for 2-4 mutually exclusive options that apply at once.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  block = false,
  className,
}: SegmentedProps<T>) {
  const tabStop = tabStopValue(options, value);
  const classes = [styles.seg, block ? styles.block : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={classes}
      onKeyDown={moveSelection}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === tabStop ? 0 : -1}
          className={styles.option}
          disabled={option.disabled}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The segmented track over links (design .seg of anchors), for options that
 * each open a page. Every link is its own tab stop and arrows do nothing, so
 * moving focus never navigates; mark the current link `aria-current="page"`
 * and draw each with `segmentedLinkClassName`.
 */
export function SegmentedNav({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className={className ? `${styles.seg} ${className}` : styles.seg}
    >
      {children}
    </nav>
  );
}

/** Class for a link drawn as a `SegmentedNav` option. */
export const segmentedLinkClassName = styles.option;
