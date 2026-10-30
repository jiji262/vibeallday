import { serverHasCapability } from "@vibeallday/shared";
import { useMemo } from "react";
import { useActingPrincipal } from "../../hooks/useActingPrincipal";
import { useGlobalSessionsFeed } from "../../hooks/useGlobalSessionsFeed";
import { useProjects } from "../../hooks/useProjects";
import {
  SIDEBAR_SESSION_FEED_LIMIT,
  useSidebarSessionFeeds,
} from "../../hooks/useSidebarSessionFeeds";
import { useVersion } from "../../hooks/useVersion";
import { type TranslationFn, useI18n } from "../../i18n";
import { getSettingsCategories } from "../../i18n-settings";
import type { SessionCollectionRecord } from "../../lib/clientSummaryCollections";
import { useSessionCollectionQueryRecords } from "../../lib/clientSummaryStore";
import { limitedUserMaySeeSettingsCategory } from "../../lib/limitedUserSettings";
import { FolderIcon, ListIcon, SettingsIcon } from "../garden/icons";
import { pathTail, recentProjects } from "../sidebar/projectSwitcherModel";
import { useShellDestinations } from "../sidebar/shellDestinations";
import type { PaletteItem } from "./paletteData";
import { usePaletteActions } from "./usePaletteActions";

/** Recent sessions considered before the query filters and caps them. */
const RECENT_SESSION_POOL = 40;

function useJumpItems(t: TranslationFn): PaletteItem[] {
  const destinations = useShellDestinations();
  return useMemo(
    () =>
      destinations.map((destination) => ({
        id: `jump:${destination.key}`,
        group: "jump" as const,
        label: t(destination.labelKey),
        hint: destination.hintKey ? t(destination.hintKey) : undefined,
        to: destination.to,
        Icon: destination.Icon,
      })),
    [destinations, t],
  );
}

function useProjectItems(): PaletteItem[] {
  const { projects } = useProjects();
  return useMemo(
    () =>
      recentProjects(projects, projects.length).map((project) => ({
        id: `project:${project.id}`,
        group: "projects" as const,
        label: project.name,
        hint: pathTail(project.path),
        to: `/sessions?project=${encodeURIComponent(project.id)}&source=projects`,
        Icon: FolderIcon,
      })),
    [projects],
  );
}

function sessionLabel(record: SessionCollectionRecord, fallback: string) {
  return record.customTitle || record.title || record.fullTitle || fallback;
}

/**
 * The sidebar's recent-sessions query. Where no sidebar runs its feeds
 * (desktop Settings, a minimized or closed sidebar) the open palette runs the
 * same feed itself, so its Recent group is not left empty or stale.
 */
function useRecentSessionQuery() {
  const feeds = useSidebarSessionFeeds();
  const own = useGlobalSessionsFeed({
    enabled: !feeds.enabled,
    limit: SIDEBAR_SESSION_FEED_LIMIT,
    includeStats: false,
  });
  return feeds.enabled ? feeds.globalQuery : own.query;
}

function useRecentSessionItems(t: TranslationFn): PaletteItem[] {
  const records = useSessionCollectionQueryRecords(useRecentSessionQuery());
  return useMemo(() => {
    const fallback = t("newSessionTitle");
    return records
      .filter((record) => record.projectId && !record.isArchived)
      .slice(0, RECENT_SESSION_POOL)
      .map((record) => ({
        id: `session:${record.id}`,
        group: "recent" as const,
        label: sessionLabel(record, fallback),
        hint: record.projectName,
        to: `/projects/${record.projectId}/sessions/${record.id}`,
        Icon: ListIcon,
      }));
  }, [records, t]);
}

function useSettingsItems(t: TranslationFn): PaletteItem[] {
  const { version } = useVersion();
  const { principal } = useActingPrincipal();
  const limited = principal.username !== null;
  return useMemo(
    () =>
      getSettingsCategories((key) => t(key as never))
        .filter(
          (category) =>
            !category.requires ||
            category.requires.anyCapability.some((capability) =>
              serverHasCapability(version, capability),
            ),
        )
        .filter(
          (category) =>
            !limited || limitedUserMaySeeSettingsCategory(category.id),
        )
        .map((category) => ({
          id: `settings:${category.id}`,
          group: "settings" as const,
          label: category.label,
          hint: category.description,
          to: `/settings/${category.id}`,
          Icon: SettingsIcon,
        })),
    [limited, t, version],
  );
}

/**
 * Palette rows from data the shell has already loaded, then the commands;
 * no new requests.
 */
export function usePaletteCandidates(): PaletteItem[] {
  const { t } = useI18n();
  const jump = useJumpItems(t);
  const projects = useProjectItems();
  const recent = useRecentSessionItems(t);
  const settings = useSettingsItems(t);
  const actions = usePaletteActions();
  return useMemo(
    () => [...jump, ...projects, ...recent, ...settings, ...actions],
    [actions, jump, projects, recent, settings],
  );
}
