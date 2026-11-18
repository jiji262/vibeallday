import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import styles from "./SessionViews.module.css";

/**
 * Shared Sessions destination sub-navigation (Inbox | All) across both desktop
 * and phone layouts. Desktop renders an inline segmented control aligned with
 * the page content width; phones stretch it across the column.
 */
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
      <div className={styles.inner}>
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
      </div>
    </nav>
  );
}
