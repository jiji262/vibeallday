import {
  DEVICE_BRIDGE_CAPABILITY,
  DEVICE_BRIDGE_DOWNLOAD_CAPABILITY,
  GIT_STATUS_ENHANCED_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { SidebarIcons } from "../components/SidebarNavItem";
import { useOptionalRemoteConnection } from "../contexts/RemoteConnectionContext";
import { useActingPrincipal } from "../hooks/useActingPrincipal";
import { useGlobalActiveAgents } from "../hooks/useGlobalActiveAgents";
import { useIssuesEnabled } from "../hooks/useIssuesEnabled";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useServerSettings } from "../hooks/useServerSettings";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { bangHistoryViewEnabled } from "../lib/bangCommandAvailability";
import { buildFrontendReloadUrl } from "../lib/frontendReload";
import { markSwitchHostReload } from "../lib/switchHostReload";
import styles from "./MorePage.module.css";

interface MoreItem {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  to?: string;
  onSelect?: () => void;
  live?: boolean;
}

/** A row, or the falsy result of its gate. */
type MoreCandidate = MoreItem | false | null | "" | undefined;

function isMoreItem(item: MoreCandidate): item is MoreItem {
  return Boolean(item);
}

/** Workspace destinations, behind the sidebar's capability and limited-user gates. */
function useWorkspaceItems(): MoreItem[] {
  const { t } = useI18n();
  const { version } = useVersion();
  const { settings } = useServerSettings();
  const issuesEnabled = useIssuesEnabled();
  const { principal } = useActingPrincipal();
  const activeAgents = useGlobalActiveAgents();
  const limited = principal.username !== null;
  const has = (capability: string) => serverHasCapability(version, capability);
  const devices =
    has(DEVICE_BRIDGE_CAPABILITY) || has(DEVICE_BRIDGE_DOWNLOAD_CAPABILITY);
  const candidates: MoreCandidate[] = [
    !limited && {
      key: "agents",
      label: t("agentsTitle"),
      hint: t("moreAgentsHint"),
      icon: SidebarIcons.agents,
      to: "/agents",
      live: activeAgents > 0,
    },
    has(GIT_STATUS_ENHANCED_CAPABILITY) && {
      key: "source-control",
      label: t("sidebarSourceControl"),
      hint: t("moreSourceControlHint"),
      icon: SidebarIcons.sourceControl,
      to: "/git-status",
    },
    issuesEnabled &&
      !limited && {
        key: "issues",
        label: t("issuesTitle"),
        hint: t("moreIssuesHint"),
        icon: SidebarIcons.issues,
        to: "/issues",
      },
    !limited &&
      bangHistoryViewEnabled(version, settings?.clientDefaults) && {
        key: "bang-commands",
        label: t("sidebarBangCommands"),
        hint: t("moreBangCommandsHint"),
        icon: SidebarIcons.bang,
        to: "/bang-commands",
      },
    !limited &&
      devices && {
        key: "devices",
        label: t("sidebarDevices"),
        hint: t("moreDevicesHint"),
        icon: SidebarIcons.emulator,
        to: "/devices",
      },
  ];
  return candidates.filter(isMoreItem);
}

function switchHost(
  remoteConnection: NonNullable<ReturnType<typeof useOptionalRemoteConnection>>,
) {
  if (remoteConnection.switchHost) {
    remoteConnection.switchHost();
    return;
  }
  remoteConnection.disconnect();
  markSwitchHostReload();
  window.location.replace(
    buildFrontendReloadUrl(window.location.href, String(Date.now())),
  );
}

/** Acting as another user changes every list, so the app reloads as yourself. */
async function returnToSuperuser() {
  await api.logoutUser();
  window.location.reload();
}

/** Settings, the switched superuser's way back, and relay host switching. */
function useAppItems(): MoreItem[] {
  const { t } = useI18n();
  const { principal } = useActingPrincipal();
  const remoteConnection = useOptionalRemoteConnection();
  const candidates: MoreCandidate[] = [
    {
      key: "settings",
      label: t("sidebarSettings"),
      hint: t("moreSettingsHint"),
      icon: SidebarIcons.settings,
      to: "/settings",
    },
    principal.switched &&
      principal.username && {
        key: "return-to-superuser",
        label: t("sidebarReturnToSuperuser", { username: principal.username }),
        hint: t("moreReturnToSuperuserHint"),
        icon: RETURN_ICON,
        onSelect: () => void returnToSuperuser(),
      },
    remoteConnection && {
      key: "switch-host",
      label: t("sidebarSwitchHost"),
      hint: t("moreSwitchHostHint"),
      icon: SWITCH_HOST_ICON,
      onSelect: () => switchHost(remoteConnection),
    },
  ];
  return candidates.filter(isMoreItem);
}

const RETURN_ICON = (
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
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const SWITCH_HOST_ICON = (
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
    <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" />
  </svg>
);

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

function MoreRow({ item, basePath }: { item: MoreItem; basePath: string }) {
  const body = (
    <>
      <span className={styles.icon}>{item.icon}</span>
      <span className={styles.text}>
        <span className={styles.label}>
          {item.label}
          {item.live ? (
            <span className={styles.live} aria-hidden="true" />
          ) : null}
        </span>
        <span className={styles.hint}>{item.hint}</span>
      </span>
      <span className={styles.chevron}>{CHEVRON}</span>
    </>
  );
  if (item.to) {
    return (
      <Link to={`${basePath}${item.to}`} className={styles.row}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.row} onClick={item.onSelect}>
      {body}
    </button>
  );
}

function MoreGroup({
  title,
  items,
  basePath,
}: {
  title: string;
  items: MoreItem[];
  basePath: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.group} aria-label={title}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <div className={styles.card}>
        {items.map((item) => (
          <MoreRow key={item.key} item={item} basePath={basePath} />
        ))}
      </div>
    </section>
  );
}

/** Phone "More" tab: the destinations the tab bar leaves out. */
export function MorePage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const basePath = useRemoteBasePath();
  const workspace = useWorkspaceItems();
  const app = useAppItems();

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("tabMore")}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${styles.page}`}>
          <MoreGroup
            title={t("moreWorkspaceGroup")}
            items={workspace}
            basePath={basePath}
          />
          <MoreGroup
            title={t("moreAppGroup")}
            items={app}
            basePath={basePath}
          />
        </div>
      </main>
    </MainContent>
  );
}
