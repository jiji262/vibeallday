import { Link } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { useNavigationLayout } from "../layouts/NavigationLayout";
import { SidebarToggleIcon } from "./SidebarLauncher";
import styles from "./SessionNavigationControl.module.css";

/** Phone details return to their list; narrow desktop windows keep the drawer. */
export function SessionNavigationControl({ projectId }: { projectId: string }) {
  const { tabBarNavigation, openSidebar } = useNavigationLayout();
  const basePath = useRemoteBasePath();
  const { t } = useI18n();
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
  return (
    <Link
      className={`sidebar-toggle ${styles.back}`}
      to={`${basePath}/sessions?${new URLSearchParams({ project: projectId })}`}
      title={t("sessionBackToList")}
      aria-label={t("sessionBackToList")}
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
