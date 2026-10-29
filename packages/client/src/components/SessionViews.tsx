import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { useOptionalNavigationLayout } from "../layouts/NavigationLayout";
import { TabList, tabClassName } from "./garden/Tabs";
import styles from "./SessionViews.module.css";

/**
 * Phone tab-bar layout only: the Sessions tab covers Overview and All, so the
 * page offers both as tabs. The sidebar lists them separately elsewhere.
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
      <TabList>
        <Link
          to={`${basePath}/inbox${search}`}
          className={tabClassName(!all, styles.tab)}
          aria-current={!all ? "page" : undefined}
        >
          {t("sessionOverview")}
        </Link>
        <Link
          to={`${basePath}/sessions${search}`}
          className={tabClassName(all, styles.tab)}
          aria-current={all ? "page" : undefined}
        >
          {t("sessionViewAll")}
        </Link>
      </TabList>
    </nav>
  );
}
