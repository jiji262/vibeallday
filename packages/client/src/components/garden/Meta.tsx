import type { ReactNode } from "react";
import styles from "./Meta.module.css";

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

/** Key/value description list; `columns={2}` for count pairs. */
export function MetaGrid({
  columns = 1,
  className,
  children,
}: {
  columns?: 1 | 2;
  className?: string;
  children: ReactNode;
}) {
  return (
    <dl className={join(styles.grid, columns === 2 && styles.two, className)}>
      {children}
    </dl>
  );
}

/** Mono UPPERCASE label over a 14px value that wraps anywhere. */
export function MetaField({
  label,
  value,
  mono = false,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={styles.field}>
      <dt className={styles.label}>{label}</dt>
      <dd className={join(styles.value, mono && styles.mono)}>{value}</dd>
    </div>
  );
}

/** Dashed rule between meta groups; spans every column. */
export function MetaDivider() {
  return <div className={styles.divider} role="presentation" />;
}

export type BigNumberTone = "ink" | "mint" | "rose" | "indigo" | "peach";

const NUMBER_TONE_CLASS: Record<BigNumberTone, string | undefined> = {
  ink: undefined,
  mint: styles.mint,
  rose: styles.rose,
  indigo: styles.indigo,
  peach: styles.peach,
};

/** Serif 22px tabular numeral for a count inside a meta card. */
export function BigNumber({
  tone = "ink",
  children,
}: {
  tone?: BigNumberTone;
  children: ReactNode;
}) {
  return (
    <span className={join(styles.bigNumber, NUMBER_TONE_CLASS[tone])}>
      {children}
    </span>
  );
}
