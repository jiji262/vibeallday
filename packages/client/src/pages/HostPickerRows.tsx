import type { MouseEvent } from "react";
import { useI18n } from "../i18n";
import type { SavedHost } from "../lib/hostStorage";
import styles from "./HostPickerPage.module.css";

export type HostStatus = "online" | "offline" | "checking" | "unknown";

const STATUS_CLASS: Record<HostStatus, string | undefined> = {
  online: styles.online,
  offline: styles.offline,
  checking: styles.checking,
  unknown: styles.unknown,
};

const STATUS_LABEL_KEY = {
  online: "hostPickerStatusOnline",
  offline: "hostPickerStatusOffline",
  checking: "hostPickerStatusChecking",
  unknown: "hostPickerStatusUnknown",
} as const satisfies Record<HostStatus, string>;

const CHEVRON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

const REMOVE_ICON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

interface HostRowProps {
  host: SavedHost;
  status: HostStatus;
  connecting: boolean;
  lastConnected: string;
  onConnect: () => void;
  onRemove: (event: MouseEvent) => void;
}

/** One saved host: tap the row to connect, the end button removes it. */
export function HostRow({
  host,
  status,
  connecting,
  lastConnected,
  onConnect,
  onRemove,
}: HostRowProps) {
  const { t } = useI18n();
  const statusLabel = t(STATUS_LABEL_KEY[status]);
  const meta = [host.mode, statusLabel, lastConnected].filter(Boolean);
  return (
    <li className={`host-picker-item ${styles.host}`}>
      <button
        type="button"
        className={styles.hostMain}
        onClick={onConnect}
        disabled={connecting}
        aria-busy={connecting}
        data-testid={`host-item-${host.id}`}
      >
        <span
          className={`${styles.dot} ${STATUS_CLASS[status]}`}
          title={statusLabel}
          aria-hidden="true"
        />
        <span className={styles.hostText}>
          <span className={styles.hostName}>{host.displayName}</span>
          <span className={styles.hostMeta}>{meta.join(" · ")}</span>
        </span>
        {connecting ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : null}
      </button>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        title={t("hostPickerRemoveHost")}
        aria-label={t("hostPickerRemoveHost")}
        data-testid={`delete-host-${host.id}`}
      >
        {REMOVE_ICON}
      </button>
    </li>
  );
}

interface ModeOptionProps {
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
}

/** A way to add a host: title, one line of explanation, chevron. */
export function ModeOption({
  title,
  description,
  onClick,
  testId,
}: ModeOptionProps) {
  return (
    <button
      type="button"
      className={styles.option}
      onClick={onClick}
      data-testid={testId}
    >
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionDesc}>{description}</span>
      </span>
      <span className={styles.chevron}>{CHEVRON}</span>
    </button>
  );
}
