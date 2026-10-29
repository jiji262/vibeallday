import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import styles from "./DataList.module.css";

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

interface DataListProps extends HTMLAttributes<HTMLElement> {
  /** CSS grid-template-columns shared by the header and every row. */
  columns?: string;
  /** `ul` for list semantics (default); `div` for a grid of links. */
  as?: "ul" | "ol" | "div";
}

export function DataList({
  columns,
  as: Element = "ul",
  className,
  style,
  children,
  ...rest
}: DataListProps) {
  const listStyle = columns
    ? ({ ...style, "--data-list-columns": columns } as CSSProperties)
    : style;
  return (
    <Element
      className={join(styles.list, className)}
      style={listStyle}
      {...rest}
    >
      {children}
    </Element>
  );
}

/**
 * Sunken mono column labels, rendered as a sibling just before `DataList`
 * (a list may only contain rows). Pass the list's `columns` as `template`.
 * Hidden below 768px, where rows stack.
 */
export function DataListHeader({
  columns,
  template,
  className,
}: {
  columns: ReactNode[];
  template?: string;
  className?: string;
}) {
  const style = template
    ? ({ "--data-list-columns": template } as CSSProperties)
    : undefined;
  return (
    <div
      className={join(styles.header, className)}
      style={style}
      aria-hidden="true"
    >
      {columns.map((column, index) => (
        <span key={index} className={styles.cell}>
          {column}
        </span>
      ))}
    </div>
  );
}

export interface DataListRowFlags {
  /** Hover fill, pointer cursor and an inset focus ring. */
  interactive?: boolean;
  selected?: boolean;
  danger?: boolean;
}

/** Row classes for any element (li, a, button) that must own the row. */
export function dataListRowClassName(
  flags: DataListRowFlags = {},
  className?: string,
): string {
  return join(
    styles.row,
    flags.interactive && styles.interactive,
    flags.danger && styles.danger,
    flags.selected && styles.selected,
    className,
  );
}

interface DataListRowProps
  extends HTMLAttributes<HTMLElement>,
    DataListRowFlags {
  as?: "li" | "div";
}

export function DataListRow({
  as: Element = "li",
  interactive,
  selected,
  danger,
  className,
  children,
  ...rest
}: DataListRowProps) {
  return (
    <Element
      className={dataListRowClassName(
        { interactive, selected, danger },
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}

interface DataListCellProps extends HTMLAttributes<HTMLSpanElement> {
  /** Takes the full first line when rows stack on phones; truncates. */
  primary?: boolean;
  mono?: boolean;
  num?: boolean;
  muted?: boolean;
  right?: boolean;
  /** Dropped from the stacked phone layout. */
  hideOnPhone?: boolean;
}

export function DataListCell({
  primary,
  mono,
  num,
  muted,
  right,
  hideOnPhone,
  className,
  children,
  ...rest
}: DataListCellProps) {
  return (
    <span
      className={join(
        styles.cell,
        primary && styles.primary,
        mono && styles.mono,
        num && styles.num,
        muted && styles.muted,
        right && styles.right,
        hideOnPhone && styles.phoneHidden,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
