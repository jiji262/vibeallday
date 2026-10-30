import { Link, useLocation } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { useNavigationLayout } from "../layouts/NavigationLayout";
import { SidebarToggleIcon } from "./SidebarLauncher";
import { readTriageReturn } from "./triage/triageQueue";
import styles from "./SessionNavigationControl.module.css";

/**
 * Phone details return to their list, or to Triage with its progress when
 * Triage opened them; narrow desktop windows keep the drawer.
 */
export function SessionNavigationControl({ projectId }: { projectId: string }) {
  const { tabBarNavigation, openSidebar } = useNavigationLayout();
  const basePath = useRemoteBasePath();
  const { t } = useI18n();
  const triage = readTriageReturn(useLocation().state);
  if (!tabBarNavigation) {
    return (
      <button
        type="button"
        className="sidebar-toggle"
        onClick={openSidebar}
        title={t("sessionOpenSidebar")}
        aria-label={t("sessionOpenSidebar")}
      >
        <SidebarToggleIcon />
      </button>
    );
  }
  const label = triage ? t("sessionBackToTriage") : t("sessionBackToList");
  return (
    <Link
      className={`sidebar-toggle ${styles.back}`}
      to={
        triage?.to ??
        `${basePath}/sessions?${new URLSearchParams({ project: projectId })}`
      }
      state={triage ? { triage: triage.progress } : undefined}
      title={label}
      aria-label={label}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </Link>
  );
}
