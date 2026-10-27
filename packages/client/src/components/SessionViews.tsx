import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import styles from "./SessionViews.module.css";

/** Keep established URLs and lazy page boundaries under one destination. */
export function SessionViews() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const project = params.get("project");
  const search = project ? `?${new URLSearchParams({ project })}` : "";
  const all = pathname === `${basePath}/sessions`;
  return (
    <nav className={styles.views} aria-label={t("sessionViewsLabel")}>
      <Link
        to={`${basePath}/inbox${search}`}
        className={styles.view}
        aria-current={!all ? "page" : undefined}
      >
        {t("sessionOverview")}
      </Link>
      <Link
        to={`${basePath}/sessions${search}`}
        className={styles.view}
        aria-current={all ? "page" : undefined}
      >
        {t("sessionViewAll")}
      </Link>
    </nav>
  );
}
