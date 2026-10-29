import type { MouseEvent } from "react";
import { Badge, type BadgeTone } from "../components/garden/Badge";
import { ChevronRightIcon, XIcon } from "../components/garden/icons";
import { Spinner } from "../components/garden/Spinner";
import { useI18n } from "../i18n";
import type { SavedHost } from "../lib/hostStorage";
import styles from "./HostPickerPage.module.css";

export type HostStatus = "online" | "offline" | "checking" | "unknown";

const STATUS_TONE: Record<HostStatus, BadgeTone> = {
  online: "mint",
  offline: "rose",
  checking: "sand",
  unknown: "grey",
};

const STATUS_LABEL_KEY = {
  online: "hostPickerStatusOnline",
  offline: "hostPickerStatusOffline",
  checking: "hostPickerStatusChecking",
  unknown: "hostPickerStatusUnknown",
} as const satisfies Record<HostStatus, string>;

const ICON_SIZE = 16;

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
  const meta = [host.mode, lastConnected].filter(Boolean);
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
        <span className={styles.hostText}>
          <span className={styles.hostName}>{host.displayName}</span>
          <span className={styles.hostMeta}>{meta.join(" · ")}</span>
        </span>
        {connecting ? (
          <Spinner size={16} />
        ) : (
          <Badge
            tone={STATUS_TONE[status]}
            dot={status === "checking" ? "pulse" : true}
          >
            {statusLabel}
          </Badge>
        )}
      </button>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        title={t("hostPickerRemoveHost")}
        aria-label={t("hostPickerRemoveHost")}
        data-testid={`delete-host-${host.id}`}
      >
        <XIcon size={ICON_SIZE} />
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
      <ChevronRightIcon size={ICON_SIZE} className={styles.chevron} />
    </button>
  );
}
