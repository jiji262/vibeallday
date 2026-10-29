import {
  DEVICE_BRIDGE_CAPABILITY,
  DEVICE_BRIDGE_DOWNLOAD_CAPABILITY,
  GIT_STATUS_ENHANCED_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import { type ComponentType, useMemo } from "react";
import { useActingPrincipal } from "../../hooks/useActingPrincipal";
import { useIssuesEnabled } from "../../hooks/useIssuesEnabled";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useVersion } from "../../hooks/useVersion";
import type { MessageKey } from "../../i18n";
import { bangHistoryViewEnabled } from "../../lib/bangCommandAvailability";
import {
  BugIcon,
  CpuIcon,
  FolderIcon,
  GitBranchIcon,
  type IconProps,
  InboxIcon,
  ListIcon,
  SettingsIcon,
  SmartphoneIcon,
  TerminalIcon,
} from "../garden/icons";

export type ShellDestinationKey =
  | "overview"
  | "sessions"
  | "projects"
  | "source-control"
  | "bang-commands"
  | "issues"
  | "devices"
  | "agents"
  | "settings";

/** Sidebar group, also the More page and palette grouping. */
export type ShellDestinationGroup = "work" | "tools" | "system";

export interface ShellDestination {
  key: ShellDestinationKey;
  group: ShellDestinationGroup;
  /** Route without the relay base path. */
  to: string;
  labelKey: MessageKey;
  /** One-line description for the More page. */
  hintKey?: MessageKey;
  Icon: ComponentType<IconProps>;
  /** Shown with a Beta badge in navigation. */
  beta?: boolean;
}

interface DestinationGates {
  limited: boolean;
  sourceControl: boolean;
  bangHistory: boolean;
  issues: boolean;
  devices: boolean;
}

/**
 * One table of app destinations in sidebar order. The sidebar, the phone
 * More page and the command palette all read it, so gating lives in one place.
 */
const SHELL_DESTINATIONS: readonly ShellDestination[] = [
  {
    key: "overview",
    group: "work",
    to: "/inbox",
    labelKey: "sidebarOverview",
    Icon: InboxIcon,
  },
  {
    key: "sessions",
    group: "work",
    to: "/sessions",
    labelKey: "tabSessions",
    Icon: ListIcon,
  },
  {
    key: "projects",
    group: "work",
    to: "/projects",
    labelKey: "sidebarProjects",
    Icon: FolderIcon,
  },
  {
    key: "source-control",
    group: "work",
    to: "/git-status",
    labelKey: "sidebarSourceControl",
    hintKey: "moreSourceControlHint",
    Icon: GitBranchIcon,
  },
  {
    key: "bang-commands",
    group: "tools",
    to: "/bang-commands",
    labelKey: "sidebarBangCommands",
    hintKey: "moreBangCommandsHint",
    Icon: TerminalIcon,
  },
  {
    key: "issues",
    group: "tools",
    to: "/issues",
    labelKey: "sidebarIssues",
    hintKey: "moreIssuesHint",
    Icon: BugIcon,
    beta: true,
  },
  {
    key: "devices",
    group: "tools",
    to: "/devices",
    labelKey: "sidebarDevices",
    hintKey: "moreDevicesHint",
    Icon: SmartphoneIcon,
  },
  {
    key: "agents",
    group: "tools",
    to: "/agents",
    labelKey: "agentsTitle",
    hintKey: "moreAgentsHint",
    Icon: CpuIcon,
  },
  {
    key: "settings",
    group: "system",
    to: "/settings",
    labelKey: "sidebarSettings",
    hintKey: "moreSettingsHint",
    Icon: SettingsIcon,
  },
];

function isDestinationAvailable(
  key: ShellDestinationKey,
  gates: DestinationGates,
): boolean {
  switch (key) {
    case "source-control":
      return gates.sourceControl;
    case "bang-commands":
      return gates.bangHistory && !gates.limited;
    case "issues":
      return gates.issues && !gates.limited;
    case "devices":
      return gates.devices && !gates.limited;
    case "agents":
      return !gates.limited;
    default:
      return true;
  }
}

/**
 * Destinations the connected server and acting principal can use. Hiding is
 * cosmetic for limited users; the server refuses the same operations anyway.
 */
export function useShellDestinations(): readonly ShellDestination[] {
  const { version } = useVersion();
  const { settings } = useServerSettings();
  const issues = useIssuesEnabled();
  const { principal } = useActingPrincipal();
  const limited = principal.username !== null;
  const clientDefaults = settings?.clientDefaults;
  return useMemo(() => {
    const gates: DestinationGates = {
      limited,
      issues,
      sourceControl: serverHasCapability(
        version,
        GIT_STATUS_ENHANCED_CAPABILITY,
      ),
      bangHistory: bangHistoryViewEnabled(version, clientDefaults),
      devices:
        serverHasCapability(version, DEVICE_BRIDGE_CAPABILITY) ||
        serverHasCapability(version, DEVICE_BRIDGE_DOWNLOAD_CAPABILITY),
    };
    return SHELL_DESTINATIONS.filter((destination) =>
      isDestinationAvailable(destination.key, gates),
    );
  }, [clientDefaults, issues, limited, version]);
}

export function destinationsInGroup(
  destinations: readonly ShellDestination[],
  group: ShellDestinationGroup,
): ShellDestination[] {
  return destinations.filter((destination) => destination.group === group);
}
