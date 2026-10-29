import { projectDisplayName } from "@vibeallday/shared";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProjects } from "../../hooks/useProjects";
import { getProjectIdFromLocation } from "../../hooks/useRecentProject";
import { useI18n } from "../../i18n";
import type { Project } from "../../types";
import { ActionSheet, type ActionSheetItem } from "../garden/Sheet";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  PlusIcon,
} from "../garden/icons";
import styles from "./ProjectSwitcher.module.css";
import {
  allProjectsPath,
  isProjectActive,
  pathTail,
  projectScopedPath,
  recentProjects,
  stripBasePath,
} from "./projectSwitcherModel";

interface ProjectSwitcherProps {
  basePath: string;
  /** Closes the drawer after a pick. */
  onNavigate: () => void;
  /** Collapsed rail: a 40px square with the project's initial. */
  isRail: boolean;
}

const ICON_SIZE = 14;

function ProjectDot({ active }: { active: boolean }) {
  return (
    <span
      className={active ? `${styles.dot} ${styles.dotActive}` : styles.dot}
      aria-hidden="true"
    />
  );
}

interface SwitcherItemsInput {
  current: Project | undefined;
  projects: readonly Project[];
  basePath: string;
  go: (to: string, state?: unknown) => void;
}

function useSwitcherItems({
  current,
  projects,
  basePath,
  go,
}: SwitcherItemsInput): ActionSheetItem[] {
  const { t } = useI18n();
  const { pathname, search } = useLocation();
  const path = stripBasePath(pathname, basePath);
  const recent = recentProjects(projects).map(
    (project): ActionSheetItem => ({
      key: `project:${project.id}`,
      section: t("projectSwitcherRecent"),
      icon: <ProjectDot active={isProjectActive(project)} />,
      label: (
        <span className={styles.itemLabel}>
          <span className={styles.itemName}>{projectDisplayName(project)}</span>
          {project.id === current?.id ? <CheckIcon size={ICON_SIZE} /> : null}
        </span>
      ),
      hint: <span className={styles.itemPath}>{pathTail(project.path)}</span>,
      onSelect: () => go(projectScopedPath(path, project.id)),
    }),
  );
  return [
    {
      key: "all",
      icon: <GlobeIcon size={ICON_SIZE} />,
      label: t("projectSwitcherAll"),
      onSelect: () => go(allProjectsPath(path, search)),
    },
    ...recent,
    {
      key: "add",
      section: t("projectSwitcherManage"),
      icon: <PlusIcon size={ICON_SIZE} />,
      label: <span className={styles.addLabel}>{t("projectSwitcherAdd")}</span>,
      onSelect: () => go("/projects", { addProject: true }),
    },
  ];
}

/**
 * The project of the current route, as a pill above navigation. Picking a
 * project re-scopes the current page when it supports one (`?project=`,
 * `?projectId=`); there is no persistent global project filter.
 */
export function ProjectSwitcher({
  basePath,
  onNavigate,
  isRail,
}: ProjectSwitcherProps) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const currentId = getProjectIdFromLocation(
    location.pathname,
    location.search,
  );
  const current = currentId
    ? projects.find((project) => project.id === currentId)
    : undefined;
  const go = (to: string, state?: unknown) => {
    onNavigate();
    navigate(`${basePath}${to}`, state ? { state } : undefined);
  };
  const items = useSwitcherItems({ current, projects, basePath, go });
  const name = current ? projectDisplayName(current) : t("projectSwitcherAll");
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={triggerClassName(current !== undefined, isRail)}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-label={t("projectSwitcherLabel", { project: name })}
        title={name}
        onClick={(event) =>
          setAnchor(event.currentTarget.getBoundingClientRect())
        }
      >
        <TriggerContent current={current} name={name} isRail={isRail} />
      </button>
      {anchor ? (
        <ActionSheet
          title={t("projectSwitcherTitle")}
          items={items}
          anchorRect={anchor}
          onClose={() => setAnchor(null)}
        />
      ) : null}
    </div>
  );
}

function triggerClassName(scoped: boolean, isRail: boolean): string {
  return [
    styles.trigger,
    scoped ? styles.scoped : "",
    isRail ? styles.rail : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function TriggerContent({
  current,
  name,
  isRail,
}: {
  current: Project | undefined;
  name: string;
  isRail: boolean;
}) {
  if (isRail) {
    if (!current) return <GlobeIcon size={ICON_SIZE} />;
    return <span className={styles.initial}>{name.trim().charAt(0)}</span>;
  }
  return (
    <>
      {current ? (
        <span className={styles.mark} aria-hidden="true" />
      ) : (
        <GlobeIcon size={ICON_SIZE} className={styles.globe} />
      )}
      <span className={styles.name}>{name}</span>
      <ChevronsUpDownIcon size={ICON_SIZE} className={styles.chevron} />
    </>
  );
}
