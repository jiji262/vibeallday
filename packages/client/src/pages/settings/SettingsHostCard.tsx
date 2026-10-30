import { Tag } from "../../components/garden/Badge";
import { Button } from "../../components/garden/Button";
import { SwitchHostIcon } from "../../components/garden/icons";
import { Status } from "../../components/garden/StatusDot";
import { useHostConnection } from "../../components/shell/hostConnection";
import { switchHost } from "../../components/sidebar/connectedHost";
import { useOptionalRemoteConnection } from "../../contexts/RemoteConnectionContext";
import { useHostIdentity } from "../../contexts/HostIdentityContext";
import { useI18n } from "../../i18n";
import styles from "./SettingsHostCard.module.css";
import { type SettingsHostMode, useSettingsHost } from "./useSettingsHost";

const MODE_LABEL_KEY = {
  local: "settingsHostModeLocal",
  relay: "settingsHostModeRelay",
  direct: "settingsHostModeDirect",
} as const satisfies Record<SettingsHostMode, string>;

const SWITCH_ICON_SIZE = 14;

/** "0.10.2" reads as a release; a source build's commit hash does not. */
function formatVersion(version: string): string {
  return /^\d+\.\d+/.test(version) ? `v${version}` : version;
}

/** The host's own icon, else its initial, on the accent tile. */
function HostMark({ name, large }: { name: string; large: boolean }) {
  const { icon } = useHostIdentity();
  return (
    <span
      className={large ? `${styles.mark} ${styles.markLarge}` : styles.mark}
      aria-hidden="true"
    >
      {icon ?? (name.trim().charAt(0).toUpperCase() || "·")}
    </span>
  );
}

/**
 * The computer these settings belong to: name, how it is reached, version
 * and live connection state; remote clients can switch host from here.
 * `compact` is the settings rail's one-row form.
 */
export function SettingsHostCard({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const host = useSettingsHost();
  const remote = useOptionalRemoteConnection();
  const connection = useHostConnection();
  const mode = t(MODE_LABEL_KEY[host.mode]);
  const version = host.version ? formatVersion(host.version) : null;
  const status = (
    <Status state={connection.state}>{t(connection.labelKey)}</Status>
  );

  if (compact) {
    const meta = [mode, version].filter(Boolean).join(" · ");
    const body = (
      <>
        <HostMark name={host.name} large={false} />
        <span className={styles.text}>
          <span className={styles.compactName}>{host.name}</span>
          <span className={styles.meta}>{meta}</span>
        </span>
        {status}
      </>
    );
    return remote ? (
      <button
        type="button"
        className={`${styles.compact} ${styles.switchable}`}
        onClick={() => switchHost(remote)}
        title={t("moreSwitchHostHint")}
        aria-label={`${t("settingsHostSwitch")}: ${host.name}`}
      >
        {body}
      </button>
    ) : (
      <section className={styles.compact} aria-label={t("settingsHostAria")}>
        {body}
      </section>
    );
  }

  const meta = [mode, host.address, version].filter(Boolean).join(" · ");
  return (
    <section className={styles.card} aria-label={t("settingsHostAria")}>
      <HostMark name={host.name} large />
      <div className={styles.text}>
        <div className={styles.titleRow}>
          <h2 className={styles.name}>{host.name}</h2>
          {status}
          <Tag>{mode}</Tag>
        </div>
        <p className={styles.meta}>{meta}</p>
      </div>
      {remote ? (
        <Button
          size="sm"
          icon={<SwitchHostIcon size={SWITCH_ICON_SIZE} />}
          onClick={() => switchHost(remote)}
          title={t("moreSwitchHostHint")}
        >
          {t("settingsHostSwitch")}
        </Button>
      ) : null}
    </section>
  );
}
