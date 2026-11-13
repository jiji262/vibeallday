import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import styles from "./DataTable.module.css";

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Names the table for assistive technology when no caption is shown. */
  label?: string;
  wrapClassName?: string;
}

/** Scrolls inside its card; cells stay on one line below 1024px. */
export function Table({
  label,
  wrapClassName,
  className,
  children,
  ...rest
}: TableProps) {
  return (
    <div className={join(styles.wrap, wrapClassName)}>
      <table
        className={join(styles.table, className)}
        aria-label={label}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

interface CellFlags {
  /** Mono 13px ink-2: ids, paths, times. */
  mono?: boolean;
  /** Tabular numerals. */
  num?: boolean;
  muted?: boolean;
  right?: boolean;
}

function cellClasses(flags: CellFlags): string {
  return join(
    flags.mono && styles.mono,
    flags.num && styles.num,
    flags.muted && styles.muted,
    flags.right && styles.right,
  );
}

export function Th({
  right,
  className,
  children,
  scope = "col",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <th
      scope={scope}
      className={join(styles.th, right && styles.right, className)}
      {...rest}
    >
      {children}
    </th>
  );
}

interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  /** Rose-tinted row, e.g. a banned or failed entry. */
  danger?: boolean;
}

export function Tr({
  selected,
  danger,
  className,
  children,
  ...rest
}: TrProps) {
  return (
    <tr
      className={join(
        styles.row,
        danger && styles.dangerRow,
        selected && styles.selected,
        className,
      )}
      aria-selected={selected || undefined}
      {...rest}
    >
      {children}
    </tr>
  );
}

type TdProps = TdHTMLAttributes<HTMLTableCellElement> &
  CellFlags & {
    /** Right-aligned row of `RowAction` buttons. */
    actions?: boolean;
  };

export function Td({
  mono,
  num,
  muted,
  right,
  actions,
  className,
  children,
  ...rest
}: TdProps) {
  return (
    <td
      className={join(
        styles.td,
        cellClasses({ mono, num, muted, right }),
        actions && styles.actions,
        className,
      )}
      {...rest}
    >
      {actions ? (
        <span className={styles.actionsInner}>{children}</span>
      ) : (
        children
      )}
    </td>
  );
}

/** One full-width row with centred quiet copy. */
export function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={styles.empty}>
        {children}
      </td>
    </tr>
  );
}

const ACTION_TONE_CLASS = {
  default: undefined,
  peach: styles.peachAction,
  rose: styles.roseAction,
  indigo: styles.indigoAction,
} as const;

interface RowActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: keyof typeof ACTION_TONE_CLASS;
}

/** Text-link row action: ghost sm button with a tone colour. */
export function RowAction({
  tone = "default",
  className,
  type = "button",
  ...rest
}: RowActionProps) {
  return (
    <button
      type={type}
      className={join(styles.rowAction, ACTION_TONE_CLASS[tone], className)}
      {...rest}
    />
  );
}
