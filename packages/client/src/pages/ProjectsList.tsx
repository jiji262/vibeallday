import type { ReactNode, Ref } from "react";
import { Button } from "../components/garden/Button";
import { Card, CardFooter } from "../components/garden/Card";
import { DataList, DataListHeader } from "../components/garden/DataList";
import { EmptyState } from "../components/garden/EmptyState";
import { useI18n } from "../i18n";
import styles from "./ProjectsPage.module.css";

/** Shared by the sunken header and every ProjectCard row. */
export const PROJECT_LIST_COLUMNS =
  "minmax(0, 1fr) minmax(112px, 0.45fr) 112px 104px 176px";

interface ProjectsListProps {
  /** Rows of the filtered list currently revealed. */
  children: ReactNode;
  /** Nothing in the loaded list survives the search and source filters. */
  noMatch: boolean;
  /** Rows still hidden below the revealed page. */
  remaining: number;
  onShowMore: () => void;
  sentinelRef: Ref<HTMLDivElement>;
}

/**
 * The project list as one flush card: sunken column labels on wide screens,
 * the `.project-list-cards` rows, and a "show more" band while rows remain.
 */
export function ProjectsList({
  children,
  noMatch,
  remaining,
  onShowMore,
  sentinelRef,
}: ProjectsListProps) {
  const { t } = useI18n();
  return (
    <Card flush className={styles.listCard}>
      <DataListHeader
        template={PROJECT_LIST_COLUMNS}
        columns={[
          t("projectsColumnProject"),
          t("projectsColumnSessions"),
          t("projectsColumnQueue"),
          t("projectsColumnActivity"),
          "",
        ]}
      />
      {noMatch ? (
        <EmptyState compact title={t("projectsNoMatch")} />
      ) : (
        <DataList columns={PROJECT_LIST_COLUMNS} className="project-list-cards">
          {children}
        </DataList>
      )}
      {remaining > 0 && (
        <CardFooter band>
          <div ref={sentinelRef} className={styles.showMore}>
            <Button variant="secondary" size="sm" onClick={onShowMore}>
              {t("projectsShowMore", { count: remaining })}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
