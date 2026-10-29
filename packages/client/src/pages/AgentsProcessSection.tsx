import type { ReactNode } from "react";
import { Card, CardHeader } from "../components/garden/Card";
import { Table, Th } from "../components/garden/DataTable";
import { EmptyState } from "../components/garden/EmptyState";
import { CpuIcon } from "../components/garden/icons";
import { useI18n } from "../i18n";
import styles from "./AgentsPage.module.css";

interface ProcessSectionProps {
  title: string;
  /** Rows shown after filtering; drives the mono count. */
  count: number;
  /** Rendered instead of the table when there are no rows. */
  empty: ReactNode;
  children: ReactNode;
}

function ProcessTableHead() {
  const { t } = useI18n();
  return (
    <thead>
      <tr>
        <Th>{t("agentsColumnSession")}</Th>
        <Th>{t("agentsColumnProject")}</Th>
        <Th>{t("agentsColumnProvider")}</Th>
        <Th>{t("agentsColumnPid")}</Th>
        <Th>{t("agentsColumnStarted")}</Th>
        <Th>{t("agentsColumnResources")}</Th>
        <Th>{t("agentsColumnStatus")}</Th>
        <Th right>
          <span className={styles.visuallyHidden}>
            {t("agentsColumnActions")}
          </span>
        </Th>
      </tr>
    </thead>
  );
}

/** One process group: serif title, mono count, then a flush table. */
export function ProcessSection({
  title,
  count,
  empty,
  children,
}: ProcessSectionProps) {
  return (
    <Card as="section" flush className={styles.section} aria-label={title}>
      <CardHeader title={title} meta={count} />
      {count === 0 ? (
        empty
      ) : (
        <Table label={title}>
          <ProcessTableHead />
          <tbody>{children}</tbody>
        </Table>
      )}
    </Card>
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
