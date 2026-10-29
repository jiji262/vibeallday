import { Badge } from "../../components/garden/Badge";
import { useHostIdentity } from "../../contexts/HostIdentityContext";
import { useI18n } from "../../i18n";
import styles from "./SettingsHostCard.module.css";
import { type SettingsHostMode, useSettingsHost } from "./useSettingsHost";

const MODE_LABEL_KEY = {
  local: "settingsHostModeLocal",
  relay: "settingsHostModeRelay",
  direct: "settingsHostModeDirect",
} as const satisfies Record<SettingsHostMode, string>;

const COMPUTER_ICON = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

/** "0.10.2" reads as a release; a source build's commit hash does not. */
function formatVersion(version: string): string {
  return /^\d+\.\d+/.test(version) ? `v${version}` : version;
}

/** The computer these settings belong to, shown above every category. */
export function SettingsHostCard({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const host = useSettingsHost();
  const { icon } = useHostIdentity();
  const meta = [
    t(MODE_LABEL_KEY[host.mode]),
    host.address,
    host.version ? formatVersion(host.version) : null,
  ].filter(Boolean);

  const text = (
    <div className={styles.text}>
      <h2 className={styles.name}>{host.name}</h2>
      <p className={styles.meta}>{meta.join(" · ")}</p>
    </div>
  );
  if (compact) {
    // Desktop rail: one quiet row, the dot stands for "Connected".
    return (
      <section
        className={`${styles.card} ${styles.compact}`}
        aria-label={t("settingsHostAria")}
      >
        <span
          className={styles.dot}
          role="img"
          aria-label={t("settingsHostConnected")}
          title={t("settingsHostConnected")}
        />
        {text}
      </section>
    );
  }
  return (
    <section className={styles.card} aria-label={t("settingsHostAria")}>
      <span className={styles.tile} aria-hidden="true">
        {icon ?? COMPUTER_ICON}
      </span>
      {text}
      <Badge tone="mint" dot>
        {t("settingsHostConnected")}
      </Badge>
    </section>
  );
}
