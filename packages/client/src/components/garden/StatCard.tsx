import type { ReactNode } from "react";
import styles from "./StatCard.module.css";

export type StatTone = "indigo" | "rose" | "mint" | "peach" | "sand";

const TONE_CLASS: Record<StatTone, string | undefined> = {
  indigo: styles.indigo,
  rose: styles.rose,
  mint: styles.mint,
  peach: styles.peach,
  sand: styles.sand,
};

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Soft tone fill with the tone's ink numeral; untoned = plain card. */
  tone?: StatTone;
  foot?: ReactNode;
  className?: string;
}

/** Tile classes for a StatCard drawn by a link or button. */
export function statCardClassName(tone?: StatTone, className?: string): string {
  return [styles.card, tone ? TONE_CLASS[tone] : "", className]
    .filter(Boolean)
    .join(" ");
}

/** Label, numeral and foot for a custom tile element (e.g. a router Link). */
export function StatCardContent({
  label,
  value,
  foot,
}: Pick<StatCardProps, "label" | "value" | "foot">) {
  return (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {foot ? <span className={styles.foot}>{foot}</span> : null}
    </>
  );
}

/** KPI tile: mono label, serif tabular numeral, quiet footnote. */
export function StatCard({
  label,
  value,
  tone,
  foot,
  className,
}: StatCardProps) {
  return (
    <div className={statCardClassName(tone, className)}>
      <StatCardContent label={label} value={value} foot={foot} />
    </div>
  );
}

/** Two columns on phones, auto-fit (four across) from 1024px. */
export function StatGrid({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  /** Names the group of stats for assistive technology. */
  label?: string;
}) {
  const classes = className ? `${styles.grid} ${className}` : styles.grid;
  if (!label) return <div className={classes}>{children}</div>;
  return (
    <section className={classes} aria-label={label}>
      {children}
    </section>
  );
}
