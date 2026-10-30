import {
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RemoteConnectionState } from "../../contexts/RemoteConnectionContext";
import { useActivityBusState } from "../../hooks/useActivityBusState";
import { useLongPress } from "../../hooks/useLongPress";
import { type MessageKey, useI18n } from "../../i18n";
import { getRelayBasePath } from "../../lib/remoteRoutePaths";
import {
  recentRelayHosts,
  type SwitchableRelayHost,
  SwitchHostMenu,
} from "../SwitchHostMenu";
import { StatusDot, type StatusState } from "../garden/StatusDot";
import { ChevronsUpDownIcon } from "../garden/icons";
import {
  HOST_MODE_LABEL,
  type HostMode,
  switchHost,
  useConnectedHost,
} from "./connectedHost";
import styles from "./SidebarHostFooter.module.css";

interface SidebarHostCardProps {
  basePath: string;
  onNavigate: () => void;
}

const SWITCH_ICON_SIZE = 14;

const CONNECTION_STATUS: Record<
  ReturnType<typeof useActivityBusState>["connectionState"],
  { state: StatusState; labelKey: MessageKey }
> = {
  connected: { state: "ok", labelKey: "shellHostConnected" },
  reconnecting: { state: "run", labelKey: "shellHostReconnecting" },
  disconnected: { state: "err", labelKey: "shellHostDisconnected" },
};

/** Status dot, host name and "mode · connection"; no latency is measured. */
function HostCardBody({
  name,
  mode,
  switchable,
}: {
  name: string;
  mode: HostMode;
  switchable: boolean;
}) {
  const { t } = useI18n();
  const { connectionState } = useActivityBusState();
  const status = CONNECTION_STATUS[connectionState];
  return (
    <>
      <StatusDot state={status.state} className={styles.dot} />
      <span className={`sidebar-nav-text ${styles.text}`}>
        <span className={styles.name}>{name}</span>
        <span className={styles.caption}>
          {`${t(HOST_MODE_LABEL[mode])} · ${t(status.labelKey)}`}
        </span>
      </span>
      {switchable ? (
        <ChevronsUpDownIcon
          size={SWITCH_ICON_SIZE}
          className={styles.chevron}
        />
      ) : null}
    </>
  );
}

/**
 * Card under the brand naming the machine this app talks to. Remote and
 * relay connections switch hosts from it (hold or right-click lists recent
 * relay hosts); the local app opens Settings.
 */
export function SidebarHostCard({
  basePath,
  onNavigate,
}: SidebarHostCardProps) {
  const { t } = useI18n();
  const { remote, name, mode } = useConnectedHost();

  return (
    <div className={styles.slot}>
      {remote ? (
        <RemoteHostPill remote={remote} name={name} onNavigate={onNavigate}>
          <HostCardBody name={name} mode={mode} switchable />
        </RemoteHostPill>
      ) : (
        <Link
          to={`${basePath}/settings`}
          className={`sidebar-nav-item ${styles.pill}`}
          aria-label={t("sidebarHostSettingsLabel", { host: name })}
          title={name}
          onClick={onNavigate}
        >
          <HostCardBody name={name} mode={mode} switchable={false} />
        </Link>
      )}
    </div>
  );
}

type HostMenuState = { anchor: DOMRect; hosts: SwitchableRelayHost[] } | null;

/** Where the recent-hosts menu opens, or null when there is none to show. */
function hostMenuAt(
  button: HTMLButtonElement | null,
  canListHosts: boolean,
  relayUsername: string | null,
): HostMenuState {
  if (!button || !canListHosts) return null;
  return {
    anchor: button.getBoundingClientRect(),
    hosts: recentRelayHosts(relayUsername),
  };
}

interface RemoteHostPillProps {
  remote: RemoteConnectionState;
  /** In the accessible name, so speaking the visible host reaches the pill. */
  name: string;
  onNavigate: () => void;
  children: ReactNode;
}

function RemoteHostPill({
  remote,
  name,
  onNavigate,
  children,
}: RemoteHostPillProps) {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<HostMenuState>(null);
  // Browser relay connections list recent hosts on right-click/hold; the
  // native shell owns its own host list behind switchHost.
  const relayUsername = remote.currentRelayUsername;
  const canListHosts = Boolean(relayUsername) && !remote.switchHost;
  const press = useLongPress(() =>
    setMenu(hostMenuAt(buttonRef.current, canListHosts, relayUsername)),
  );
  const closeMenu = useCallback(() => setMenu(null), []);
  const doSwitch = () => switchHost(remote);

  return (
    <>
      <SwitchHostButton
        buttonRef={buttonRef}
        name={name}
        canListHosts={canListHosts}
        press={press}
        doSwitch={doSwitch}
      >
        {children}
      </SwitchHostButton>
      {menu && (
        <SwitchHostMenu
          anchor={menu.anchor}
          hosts={menu.hosts}
          onPick={(host) => {
            onNavigate();
            navigate(`${getRelayBasePath(host.relayUsername)}/projects`);
          }}
          onShowAll={doSwitch}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

function SwitchHostButton({
  buttonRef,
  name,
  canListHosts,
  press,
  doSwitch,
  children,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  name: string;
  canListHosts: boolean;
  press: ReturnType<typeof useLongPress>;
  doSwitch: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`sidebar-nav-item sidebar-switch-host ${styles.pill}`}
      {...(canListHosts ? press.handlers : {})}
      onClick={canListHosts ? press.click(doSwitch) : doSwitch}
      aria-label={t("shellHostSwitchCurrent", { host: name })}
      title={canListHosts ? t("sidebarSwitchHostTitle") : undefined}
    >
      {children}
    </button>
  );
}
