import type { MouseEvent, ReactNode } from "react";
import styles from "./CommandPalette.module.css";
import type { PaletteItem } from "./paletteData";

const ROW_ICON_SIZE = 16;

type Range = [start: number, end: number];

/** Where each term occurs in `lower`, merged into ascending ranges. */
function matchRanges(lower: string, terms: readonly string[]): Range[] {
  const ranges: Range[] = [];
  for (const term of terms) {
    let from = lower.indexOf(term);
    while (term && from !== -1) {
      ranges.push([from, from + term.length]);
      from = lower.indexOf(term, from + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Marks the query terms in `text`; plain text when nothing matches. */
export function highlightTerms(
  text: string,
  terms: readonly string[],
): ReactNode {
  const lower = text.toLowerCase();
  // Case folding that changes length would misplace the marks.
  if (terms.length === 0 || lower.length !== text.length) return text;
  const ranges = matchRanges(lower, terms);
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className={styles.hit}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

interface RowProps {
  item: PaletteItem;
  optionId: string;
  active: boolean;
  /** Normalized query terms to mark in the label and hint. */
  terms: readonly string[];
  onHover: () => void;
  onChoose: () => void;
}

export function PaletteRow({
  item,
  optionId,
  active,
  terms,
  onHover,
  onChoose,
}: RowProps) {
  const Icon = item.Icon;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: rows are chosen from the combobox's Arrow/Enter keys; the field keeps focus
    <div
      id={optionId}
      role="option"
      // Marks split the text; the name stays the plain label and hint.
      aria-label={item.hint ? `${item.label} ${item.hint}` : item.label}
      aria-selected={active}
      tabIndex={-1}
      className={active ? `${styles.row} ${styles.active}` : styles.row}
      onMouseMove={active ? undefined : onHover}
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={onChoose}
    >
      <span className={styles.rowIcon} aria-hidden="true">
        {Icon ? <Icon size={ROW_ICON_SIZE} /> : null}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>
          {highlightTerms(item.label, terms)}
        </span>
        {item.hint ? (
          <span className={styles.rowHint}>
            {highlightTerms(item.hint, terms)}
          </span>
        ) : null}
      </span>
    </div>
  );
}
