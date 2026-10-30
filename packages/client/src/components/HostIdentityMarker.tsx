import { Link } from "react-router-dom";
import { useHostIdentity } from "../contexts/HostIdentityContext";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { StatusDot } from "./garden/StatusDot";
import styles from "./HostIdentityMarker.module.css";
import { useHostConnection } from "./shell/hostConnection";
import { useConnectedHost } from "./sidebar/connectedHost";

export function HostIdentityMarker() {
  const { icon } = useHostIdentity();
  const { t } = useI18n();
  if (!icon) return null;

  const label = t("hostIdentityMarkerAria", { icon });
  return (
    <span
      className="host-identity-marker"
      role="img"
      aria-label={label}
      title={label}
    >
      {icon}
    </span>
  );
}

/**
 * Phone page-header chip: connection state and the host's name. It opens
 * More, where the host card offers switching.
 */
export function HostChip({ className }: { className?: string }) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { name } = useConnectedHost();
  const { icon } = useHostIdentity();
  const connection = useHostConnection();
  const label = t("shellHostChipAria", {
    host: name,
    state: t(connection.labelKey),
  });
  return (
    <Link
      to={`${basePath}/more`}
      className={className ? `${styles.chip} ${className}` : styles.chip}
      aria-label={label}
      title={label}
      data-host-chip=""
    >
      <StatusDot state={connection.state} />
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.name}>{name}</span>
    </Link>
  );
}
