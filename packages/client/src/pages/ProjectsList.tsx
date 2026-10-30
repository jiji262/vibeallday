import type { ReactNode, Ref } from "react";
import { Button } from "../components/garden/Button";
import { EmptyState } from "../components/garden/EmptyState";
import { PlusIcon } from "../components/garden/icons";
import { useI18n } from "../i18n";
import styles from "./ProjectsPage.module.css";

const ADD_ICON_SIZE = 20;

interface ProjectsListProps {
  /** Cards of the filtered list currently revealed. */
  children: ReactNode;
  /** Nothing in the loaded list survives the search and source filters. */
  noMatch: boolean;
  /** Cards still hidden below the revealed page. */
  remaining: number;
  onShowMore: () => void;
  onAddProject: () => void;
  sentinelRef: Ref<HTMLDivElement>;
}

/** The dashed last tile of the grid: the same Add project entry as the header. */
function AddProjectTile({ onAddProject }: { onAddProject: () => void }) {
  const { t } = useI18n();
  return (
    <li className={styles.addItem}>
      <button type="button" className={styles.addTile} onClick={onAddProject}>
        <PlusIcon size={ADD_ICON_SIZE} />
        <span className={styles.addTitle}>{t("projectsAddCardTitle")}</span>
        <span className={styles.addHint}>{t("projectsAddCardHint")}</span>
      </button>
    </li>
  );
}

/**
 * The projects as an auto-fill card grid (`.project-list-cards`) ending in
 * the dashed Add project tile, and a "show more" button while cards remain.
 */
export function ProjectsList({
  children,
  noMatch,
  remaining,
  onShowMore,
  onAddProject,
  sentinelRef,
}: ProjectsListProps) {
  const { t } = useI18n();
  if (noMatch) return <EmptyState compact title={t("projectsNoMatch")} />;
  return (
    <>
      <ul className={`project-list-cards ${styles.grid}`}>
        {children}
        {remaining === 0 && <AddProjectTile onAddProject={onAddProject} />}
      </ul>
      {remaining > 0 && (
        <div ref={sentinelRef} className={styles.showMore}>
          <Button variant="secondary" size="sm" onClick={onShowMore}>
            {t("projectsShowMore", { count: remaining })}
          </Button>
        </div>
      )}
    </>
  );
}
