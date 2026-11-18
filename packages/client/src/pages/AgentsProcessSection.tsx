import type { ReactNode } from "react";
import { Table, Th } from "../components/garden/DataTable";
import { EmptyState } from "../components/garden/EmptyState";
import { CpuIcon } from "../components/garden/icons";
import { useI18n } from "../i18n";
import pageStyles from "./AgentsPage.module.css";
import styles from "./AgentsProcessSection.module.css";
import type { ProcessSectionKey } from "./AgentsStateFilter";

interface ProcessSectionProps {
  title: string;
  tone?: ProcessSectionKey;
  /** Rows shown after filtering; drives the mono count. */
  count: number;
  /** Rendered instead of the table when there are no rows. */
  empty: ReactNode;
  children: ReactNode;
}

function sectionDotClass(tone: ProcessSectionKey | undefined, count: number) {
  switch (tone) {
    case "active":
      return count > 0 ? styles.dotActive : styles.dotActiveQuiet;
    case "external":
      return styles.dotExternal;
    case "stopped":
      return styles.dotStopped;
    default:
      return styles.dotIdle;
  }
}

function ProcessTableHead() {
  const { t } = useI18n();
  return (
    <thead>
      <tr>
        <Th>{t("agentsColumnProcess")}</Th>
        <Th>{t("agentsColumnPid")}</Th>
        <Th>{t("agentsColumnStatus")}</Th>
        <Th>{t("agentsColumnCpu")}</Th>
        <Th>{t("agentsColumnMemory")}</Th>
        <Th>{t("agentsColumnUptime")}</Th>
        <Th right>
          <span className={styles.visuallyHidden}>
            {t("agentsColumnActions")}
          </span>
        </Th>
      </tr>
    </thead>
  );
}

/** One process group: sunken mono header band, count, then flush table. */
export function ProcessSection({
  title,
  tone,
  count,
  empty,
  children,
}: ProcessSectionProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <span
            className={`${styles.dot} ${sectionDotClass(tone, count)}`}
            aria-hidden="true"
          />
          <h2 className={styles.title}>{title}</h2>
        </div>
        <span className={styles.count}>{count}</span>
      </div>
      {count === 0 ? (
        empty
      ) : (
        <Table label={title} className={pageStyles.processTable}>
          <ProcessTableHead />
          <tbody>{children}</tbody>
        </Table>
      )}
    </section>
  );
}

/** Quiet in-card empty copy. */
export function ProcessSectionEmpty({ children }: { children: ReactNode }) {
  return <EmptyState compact title={children} />;
}

/**
 * Nothing supervised or observed at all: one dashed page-level empty state
 * instead of four cards that each hold only an empty line.
 */
export function ProcessesEmpty({ hint }: { hint: ReactNode }) {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t("agentsEmptyAllTitle")}
      hint={hint}
      icon={<CpuIcon />}
    />
  );
}
