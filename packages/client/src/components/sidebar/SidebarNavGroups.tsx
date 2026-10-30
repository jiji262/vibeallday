import { api } from "../../api/client";
import { useActingPrincipal } from "../../hooks/useActingPrincipal";
import { useI18n } from "../../i18n";
import { useInboxCounts } from "../../lib/clientSummaryStore";
import { AgentsNavItem } from "../AgentsNavItem";
import { LogOutIcon } from "../garden/icons";
import { SessionAsyncQuestionsButton } from "../SessionAsyncQuestionsButton";
import {
  SIDEBAR_ICON_SIZE,
  SidebarNavButton,
  SidebarNavGroup,
  SidebarNavItem,
  SidebarNavSection,
} from "../SidebarNavItem";
import {
  destinationsInGroup,
  type ShellDestination,
  useShellDestinations,
} from "./shellDestinations";

interface SidebarNavGroupsProps {
  basePath: string;
  onNavigate: () => void;
  /** Source control link carrying the current or preferred project. */
  sourceControlPath: string;
  /** Project Queue work across projects; 0 hides the badge. */
  projectQueueCount: number;
}

/** Acting as another user changes every list, so the app reloads as yourself. */
async function returnToSuperuser() {
  await api.logoutUser();
  window.location.reload();
}

interface DestinationItemProps {
  destination: ShellDestination;
  basePath: string;
  onNavigate: () => void;
  sourceControlPath: string;
  needsAttention: number;
  projectQueueCount: number;
}

/** One sidebar row; Overview and Projects carry their counts. */
function DestinationItem({
  destination,
  basePath,
  onNavigate,
  sourceControlPath,
  needsAttention,
  projectQueueCount,
}: DestinationItemProps) {
  const { t } = useI18n();
  if (destination.key === "agents") {
    return <AgentsNavItem onClick={onNavigate} basePath={basePath} />;
  }
  const isOverview = destination.key === "overview";
  const isProjects = destination.key === "projects";
  // App-root routes (All hosts) live outside the relay host's base path.
  const linkBasePath = destination.appRoot ? "" : basePath;
  return (
    <SidebarNavItem
      to={
        destination.key === "source-control"
          ? sourceControlPath
          : destination.to
      }
      icon={<destination.Icon size={SIDEBAR_ICON_SIZE} />}
      label={t(destination.labelKey)}
      tag={destination.beta ? t("sidebarBetaTag") : undefined}
      badge={isOverview ? needsAttention : isProjects ? projectQueueCount : 0}
      badgeVariant={isProjects ? "projectQueue" : "default"}
      badgeTitle={
        isProjects
          ? t("projectCardQueueCount", { count: projectQueueCount })
          : undefined
      }
      accessory={
        isOverview ? (
          <SessionAsyncQuestionsButton
            basePath={basePath}
            onNavigate={onNavigate}
          />
        ) : undefined
      }
      onClick={onNavigate}
      basePath={linkBasePath}
    />
  );
}

/**
 * Work and Tools destinations in one landmark. The same groups order the
 * phone More page and the command palette (`shellDestinations`); the System
 * group (Settings) sits in the sidebar footer.
 */
export function SidebarNavGroups({
  basePath,
  onNavigate,
  sourceControlPath,
  projectQueueCount,
}: SidebarNavGroupsProps) {
  const { t } = useI18n();
  const destinations = useShellDestinations({ includeAppRoot: true });
  const { needsAttention } = useInboxCounts();
  const renderDestination = (destination: ShellDestination) => (
    <DestinationItem
      key={destination.key}
      destination={destination}
      basePath={basePath}
      onNavigate={onNavigate}
      sourceControlPath={sourceControlPath}
      needsAttention={needsAttention}
      projectQueueCount={projectQueueCount}
    />
  );
  const tools = destinationsInGroup(destinations, "tools");

  return (
    <SidebarNavSection label={t("sidebarNavigationLabel")}>
      <SidebarNavGroup>
        {destinationsInGroup(destinations, "work").map(renderDestination)}
      </SidebarNavGroup>
      {tools.length > 0 ? (
        <SidebarNavGroup label={t("sidebarGroupTools")}>
          {tools.map(renderDestination)}
        </SidebarNavGroup>
      ) : null}
    </SidebarNavSection>
  );
}

/**
 * A switched superuser sees the limited user's app; this is the way
 * back that does not require finding Settings > Users.
 */
export function ReturnToSuperuserButton() {
  const { t } = useI18n();
  const { principal } = useActingPrincipal();
  const username = principal.switched ? principal.username : null;
  if (!username) return null;
  return (
    <SidebarNavButton
      className="sidebar-return-to-superuser"
      onClick={() => void returnToSuperuser()}
      label={t("sidebarReturnToSuperuser", { username })}
      icon={<LogOutIcon size={SIDEBAR_ICON_SIZE} />}
    />
  );
}
