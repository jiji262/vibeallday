/**
 * Top-level cross-session `!!` bang-command history: every locally run
 * command with exit status and on-demand rendered output, linking back to
 * the owning session. Contract: topics/bang-commands.md.
 */

import { useEffect, useState } from "react";
import { api } from "../api/client";
import { EmptyState } from "../components/garden/EmptyState";
import { TerminalIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import type { BangHistoryEntry } from "./BangCommandsPage.days";
import { BangHistoryFilters, useBangHistoryFilter } from "./BangHistoryFilters";
import { BangHistoryTimeline } from "./BangHistoryTimeline";

export function BangCommandsPage() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const [entries, setEntries] = useState<BangHistoryEntry[] | null>(null);
  const [expandedEntryKey, setExpandedEntryKey] = useState<string | null>(null);
  const filter = useBangHistoryFilter(entries);

  useEffect(() => {
    let cancelled = false;
    api.fetchBangCommandHistory().then(
      (result) => {
        if (cancelled) return;
        setEntries(
          result.entries.filter(
            (entry): entry is BangHistoryEntry =>
              entry.object.kind === "bang-command",
          ),
        );
      },
      () => {
        if (!cancelled) setEntries([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("bangHistoryTitle")}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          <PageIntro
            eyebrow={[t("sidebarGroupTools")]}
            title={t("bangHistoryTitle")}
            lede={t("bangHistoryLede")}
            meta={
              entries && entries.length > 0
                ? t("bangHistoryCount", { count: entries.length })
                : undefined
            }
          />
          {entries === null && <LoadingState label={t("bangHistoryLoading")} />}
          {entries !== null && entries.length === 0 && (
            <EmptyState title={t("bangHistoryEmpty")} icon={<TerminalIcon />} />
          )}
          {entries !== null && entries.length > 0 && (
            <BangHistoryFilters filter={filter} total={entries.length} />
          )}
          {filter.shown !== null &&
            filter.shown.length === 0 &&
            filter.filtered && (
              <EmptyState compact title={t("bangHistoryNoMatches")} />
            )}
          {filter.shown !== null && filter.shown.length > 0 && (
            <BangHistoryTimeline
              entries={filter.shown}
              basePath={basePath}
              expandedEntryKey={expandedEntryKey}
              onExpandedEntryKeyChange={setExpandedEntryKey}
            />
          )}
        </div>
      </main>
    </MainContent>
  );
}
