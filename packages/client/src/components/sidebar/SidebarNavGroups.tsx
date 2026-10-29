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
      basePath={basePath}
    />
  );
}

/**
 * Work, Tools and System destinations in one landmark. The same groups order
 * the phone More page and the command palette (`shellDestinations`).
 */
export function SidebarNavGroups({
  basePath,
  onNavigate,
  sourceControlPath,
  projectQueueCount,
}: SidebarNavGroupsProps) {
  const { t } = useI18n();
  const destinations = useShellDestinations();
  const { needsAttention } = useInboxCounts();
  const { principal } = useActingPrincipal();
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
  const switchedUsername = principal.switched ? principal.username : null;

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
      <SidebarNavGroup label={t("sidebarGroupSystem")}>
        {destinationsInGroup(destinations, "system").map(renderDestination)}
        <ReturnToSuperuserButton username={switchedUsername} />
      </SidebarNavGroup>
    </SidebarNavSection>
  );
}

/**
 * A switched superuser sees the limited user's app; this is the way
 * back that does not require finding Settings > Users.
 */
function ReturnToSuperuserButton({ username }: { username: string | null }) {
  const { t } = useI18n();
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
