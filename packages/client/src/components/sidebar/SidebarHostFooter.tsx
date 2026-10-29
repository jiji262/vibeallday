import {
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RemoteConnectionState } from "../../contexts/RemoteConnectionContext";
import { useHostIdentity } from "../../contexts/HostIdentityContext";
import { useLongPress } from "../../hooks/useLongPress";
import { useI18n } from "../../i18n";
import { getRelayBasePath } from "../../lib/remoteRoutePaths";
import {
  recentRelayHosts,
  type SwitchableRelayHost,
  SwitchHostMenu,
} from "../SwitchHostMenu";
import { switchHost, useConnectedHost } from "./connectedHost";
import styles from "./SidebarHostFooter.module.css";

interface SidebarHostFooterProps {
  basePath: string;
  onNavigate: () => void;
}

function HostPillBody({ name, caption }: { name: string; caption: string }) {
  const { icon } = useHostIdentity();
  return (
    <>
      <span className={styles.avatar} aria-hidden="true">
        {icon ?? name.trim().charAt(0).toUpperCase()}
      </span>
      <span className={`sidebar-nav-text ${styles.text}`}>
        <span className={styles.name}>{name}</span>
        <span className={styles.caption}>{caption}</span>
      </span>
    </>
  );
}

/**
 * Footer pill naming the machine this app talks to. Remote and relay
 * connections switch hosts from it (hold or right-click lists recent relay
 * hosts); the local app opens Settings.
 */
export function SidebarHostFooter({
  basePath,
  onNavigate,
}: SidebarHostFooterProps) {
  const { t } = useI18n();
  const { remote, name, caption } = useConnectedHost();

  return (
    <div className={styles.footer}>
      {remote ? (
        <RemoteHostPill remote={remote} name={name} onNavigate={onNavigate}>
          <HostPillBody name={name} caption={caption} />
        </RemoteHostPill>
      ) : (
        <Link
          to={`${basePath}/settings`}
          className={`sidebar-nav-item ${styles.pill}`}
          aria-label={t("sidebarHostSettingsLabel", { host: name })}
          title={name}
          onClick={onNavigate}
        >
          <HostPillBody name={name} caption={caption} />
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
      aria-label={t("sidebarSwitchHostNamed", { host: name })}
      title={canListHosts ? t("sidebarSwitchHostTitle") : undefined}
    >
      {children}
    </button>
  );
}
