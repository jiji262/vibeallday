import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { useOptionalNavigationLayout } from "../layouts/NavigationLayout";
import styles from "./SessionViews.module.css";

/**
 * Phone tab-bar layout only: the Sessions tab covers Inbox and All, so the
 * page offers both as a segmented control (design `.seg.block`). The sidebar
 * lists them separately elsewhere.
 */
export function SessionViews() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const tabBarNavigation = useOptionalNavigationLayout()?.tabBarNavigation;
  if (!tabBarNavigation) return null;
  const project = params.get("project");
  const search = project ? `?${new URLSearchParams({ project })}` : "";
  const all = pathname === `${basePath}/sessions`;
  return (
    <nav className={styles.views} aria-label={t("sessionViewsLabel")}>
      <div className={styles.seg}>
        <Link
          to={`${basePath}/inbox${search}`}
          className={styles.option}
          aria-current={!all ? "page" : undefined}
        >
          {t("shellNavInbox")}
        </Link>
        <Link
          to={`${basePath}/sessions${search}`}
          className={styles.option}
          aria-current={all ? "page" : undefined}
        >
          {t("sessionViewAll")}
        </Link>
      </div>
    </nav>
  );
}
