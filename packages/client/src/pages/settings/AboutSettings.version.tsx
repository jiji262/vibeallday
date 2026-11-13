import type { ReactNode } from "react";
import type { VersionInfo } from "../../api/client";
import { Card } from "../../components/garden";
import { useI18n } from "../../i18n";
import {
  formatRemoteServerVersion,
  parseSemver,
} from "../../lib/remoteCompatibilityNotices";
import styles from "./AboutSettings.module.css";

type Translate = ReturnType<typeof useI18n>["t"];

const COMMIT_PREVIEW_LENGTH = 12;

/** A commit or file time in the reader's locale, to the minute. */
function formatRevisionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Server version for display, with the "unknown" fallbacks localized. */
function serverVersionLabel(info: VersionInfo, t: Translate): string {
  if (parseSemver(info.current)) {
    return formatRemoteServerVersion(info.current, info.installSource);
  }
  return t(
    info.installSource === "source"
      ? "aboutServerVersionSourceUnknown"
      : "aboutServerVersionUnknown",
  );
}

/** Release builds read "v1.2.3"; a source build's version is a commit id. */
function clientVersionLabel(version: string): string {
  return parseSemver(version) ? `v${version.replace(/^v/, "")}` : version;
}

/** One "Label: value" fact; the whole line stays one text run. */
function VersionFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <p className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>{" "}
      <span className={styles.factValue}>{children}</span>
    </p>
  );
}

function ServerCommitFact({
  revision,
}: {
  revision: NonNullable<VersionInfo["sourceRevision"]>;
}) {
  const { t } = useI18n();
  return (
    <VersionFact label={t("aboutServerCommit")}>
      <code title={revision.commit}>
        {revision.commit.slice(0, COMMIT_PREVIEW_LENGTH)}
      </code>{" "}
      {formatRevisionTime(revision.committedAt)}
      {revision.modified && (
        <span className={styles.modified}>
          {" "}
          {revision.modifiedAt
            ? t("aboutServerModifiedAt", {
                time: formatRevisionTime(revision.modifiedAt),
              })
            : t("aboutServerModified")}
        </span>
      )}
    </VersionFact>
  );
}

function BrowserVersionFacts({
  versionInfo,
}: {
  versionInfo: VersionInfo | null;
}) {
  const { t } = useI18n();
  return (
    <>
      <VersionFact label={t("aboutServerVersion")}>
        {versionInfo ? serverVersionLabel(versionInfo, t) : t("loginLoading")}
      </VersionFact>
      {versionInfo?.sourceRevision && (
        <ServerCommitFact revision={versionInfo.sourceRevision} />
      )}
      <VersionFact label={t("aboutClientVersion")}>
        {clientVersionLabel(__APP_VERSION__)}
      </VersionFact>
    </>
  );
}

interface AboutVersionCardProps {
  versionInfo: VersionInfo | null;
  versionError: boolean;
  /** Inline remote-compatibility notice (dismissed banners restore here). */
  notice?: ReactNode;
}

/** Version card: brand, server revision and browser client version. */
export function AboutVersionCard({
  versionInfo,
  versionError,
  notice,
}: AboutVersionCardProps) {
  const { t } = useI18n();
  return (
    <Card as="section" className={styles.versionCard}>
      <div className={styles.versionHead}>
        <div className={styles.versionTitle}>
          <span className={styles.brand}>VibeAllDay</span>
          <h2 className={styles.versionHeading}>{t("aboutVersionTitle")}</h2>
        </div>
      </div>
      <div className={styles.facts}>
        <BrowserVersionFacts versionInfo={versionInfo} />
      </div>
      {versionError && (
        <p className="settings-warning">{t("aboutUnableRefresh")}</p>
      )}
      {notice}
    </Card>
  );
}
