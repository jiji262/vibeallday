import {
  GIT_STATUS_ENHANCED_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import { type ComponentType, useMemo } from "react";
import { useActingPrincipal } from "../../hooks/useActingPrincipal";
import { useIssuesEnabled } from "../../hooks/useIssuesEnabled";
import { useVersion } from "../../hooks/useVersion";
import type { MessageKey } from "../../i18n";
import {
  BugIcon,
  CpuIcon,
  FolderIcon,
  GitBranchIcon,
  type IconProps,
  InboxIcon,
  SettingsIcon,
} from "../garden/icons";

export type ShellDestinationKey =
  | "sessions"
  | "projects"
  | "source-control"
  | "issues"
  | "agents"
  | "settings";

/** Sidebar group, also the More page and palette grouping. */
export type ShellDestinationGroup = "work" | "tools" | "system";

export interface ShellDestination {
  key: ShellDestinationKey;
  group: ShellDestinationGroup;
  /** Route without the relay base path. */
  to: string;
  /** Additional route paths highlighted as active for this destination. */
  activePaths?: readonly string[];
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
  issues: boolean;
}

/**
 * One table of app destinations in sidebar order. Desktop sidebar, phone
 * More page and the command palette all read it, so gating lives in one place.
 * Sessions consolidates Inbox (/inbox), All (/sessions) and Triage (/triage)
 * behind one entry with in-page view tabs on both desktop and phone.
 */
const SHELL_DESTINATIONS: readonly ShellDestination[] = [
  {
    key: "sessions",
    group: "work",
    to: "/inbox",
    activePaths: ["/inbox", "/sessions", "/triage"],
    labelKey: "tabSessions",
    Icon: InboxIcon,
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
    key: "agents",
    group: "tools",
    to: "/agents",
    labelKey: "agentsTitle",
    hintKey: "moreAgentsHint",
    Icon: CpuIcon,
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
    case "issues":
      return gates.issues && !gates.limited;
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
  const issues = useIssuesEnabled();
  const { principal } = useActingPrincipal();
  const limited = principal.username !== null;
  return useMemo(() => {
    const gates: DestinationGates = {
      limited,
      issues,
      sourceControl: serverHasCapability(
        version,
        GIT_STATUS_ENHANCED_CAPABILITY,
      ),
    };
    return SHELL_DESTINATIONS.filter((destination) =>
      isDestinationAvailable(destination.key, gates),
    );
  }, [issues, limited, version]);
}

export function destinationsInGroup(
  destinations: readonly ShellDestination[],
  group: ShellDestinationGroup,
): ShellDestination[] {
  return destinations.filter((destination) => destination.group === group);
}
