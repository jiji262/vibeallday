import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { Count } from "../garden/Count";
import styles from "./TriageEntry.module.css";

interface TriageEntryProps {
  count: number;
  basePath: string;
  projectId?: string;
}

function triageHref({ basePath, projectId }: TriageEntryProps): string {
  const query = projectId
    ? `?${new URLSearchParams({ project: projectId })}`
    : "";
  return `${basePath}/triage${query}`;
}

/** Desktop top-bar entry to one-by-one triage; hidden on phone. */
export function TriageEntryButton(props: TriageEntryProps) {
  const { t } = useI18n();
  if (props.count <= 0) return null;
  return (
    <Link
      className={styles.button}
      to={triageHref(props)}
      aria-label={t("inboxTriageEntryLabel", { count: props.count })}
    >
      {t("inboxTriageEntry")}
      <Count tone="attn">{props.count}</Count>
    </Link>
  );
}

/** Phone banner above the sections; the desktop button covers wide screens. */
export function TriageBanner(props: TriageEntryProps) {
  const { t } = useI18n();
  if (props.count <= 0) return null;
  return (
    <Link className={styles.banner} to={triageHref(props)}>
      <span className={styles.bannerText}>
        <span className={styles.bannerTitle}>
          {t("inboxTriageBannerTitle", { count: props.count })}
        </span>
        <span className={styles.bannerHint}>{t("inboxTriageBannerHint")}</span>
      </span>
      <span className={styles.bannerAction}>{t("inboxTriageEntry")}</span>
    </Link>
  );
}
