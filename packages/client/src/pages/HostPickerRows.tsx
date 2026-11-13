import type { MouseEvent } from "react";
import { Tag } from "../components/garden/Badge";
import { Button, IconButton } from "../components/garden/Button";
import { ChevronRightIcon, XIcon } from "../components/garden/icons";
import {
  Status,
  StatusDot,
  type StatusState,
} from "../components/garden/StatusDot";
import { useI18n } from "../i18n";
import type { SavedHost } from "../lib/hostStorage";
import styles from "./HostPickerPage.module.css";

export type HostStatus = "online" | "offline" | "checking" | "unknown";

/** Status = colour + shape: online ok, offline err, checking run, unknown idle. */
const STATUS_STATE: Record<HostStatus, StatusState> = {
  online: "ok",
  offline: "err",
  checking: "run",
  unknown: "idle",
};

const STATUS_LABEL_KEY = {
  online: "hostPickerStatusOnline",
  offline: "hostPickerStatusOffline",
  checking: "hostPickerStatusChecking",
  unknown: "hostPickerStatusUnknown",
} as const satisfies Record<HostStatus, string>;

const MODE_LABEL_KEY = {
  relay: "hostPickerModeRelay",
  direct: "hostPickerModeDirect",
} as const satisfies Record<SavedHost["mode"], string>;

const ICON_SIZE = 16;

interface HostRowProps {
  host: SavedHost;
  status: HostStatus;
  current: boolean;
  connecting: boolean;
  lastConnected: string;
  onConnect: () => void;
  onRemove: (event: MouseEvent) => void;
}

function hostInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

/** One saved host: avatar with state, name, meta, Connect and remove. */
export function HostRow({
  host,
  status,
  current,
  connecting,
  lastConnected,
  onConnect,
  onRemove,
}: HostRowProps) {
  const { t } = useI18n();
  const state = STATUS_STATE[status];
  const meta = [
    t(MODE_LABEL_KEY[host.mode]),
    lastConnected ? t("hostPickerLastSeen", { time: lastConnected }) : "",
  ].filter(Boolean);
  return (
    <li className={`host-picker-item ${styles.host}`}>
      <span
        className={
          current ? `${styles.avatar} ${styles.avatarOn}` : styles.avatar
        }
        aria-hidden="true"
      >
        {hostInitial(host.displayName)}
        <StatusDot state={state} className={styles.avatarDot} />
      </span>
      <span className={styles.hostText}>
        <span className={styles.nameRow}>
          <span className={styles.hostName}>{host.displayName}</span>
          {current ? <Tag tone="accent">{t("hostPickerCurrent")}</Tag> : null}
        </span>
        <span className={styles.hostMeta}>{meta.join(" · ")}</span>
      </span>
      <Status state={state} className={styles.hostStatus}>
        {t(STATUS_LABEL_KEY[status])}
      </Status>
      <Button
        size="sm"
        variant={current ? "primary" : "secondary"}
        onClick={onConnect}
        loading={connecting}
        aria-busy={connecting}
        aria-label={t("hostPickerConnectHost", { host: host.displayName })}
        data-testid={`host-item-${host.id}`}
      >
        {t("hostPickerConnect")}
      </Button>
      <IconButton
        label={t("hostPickerRemoveHost")}
        onClick={onRemove}
        data-testid={`delete-host-${host.id}`}
      >
        <XIcon size={ICON_SIZE} />
      </IconButton>
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
