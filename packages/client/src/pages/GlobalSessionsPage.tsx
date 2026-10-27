import {
  ALL_PROVIDERS,
  PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  SESSION_CONTENT_SEARCH_CAPABILITY,
  SESSION_CREATION_PROVENANCE_CAPABILITY,
  serverHasCapability,
  providerSupportsBoundedTurnSearch,
  type ProviderName,
} from "@vibeallday/shared";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createSessionApi } from "../api/sessionClient";
import { useCurrentSourceRuntime } from "../contexts/SourceRuntimeContext";
import { BulkActionBar } from "../components/BulkActionBar";
import { Button } from "../components/garden/Button";
import { EmptyState } from "../components/garden/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/garden/LoadingState";
import { SessionViews } from "../components/SessionViews";
import { useCompleteSessionCatalog } from "../hooks/useCompleteSessionCatalog";
import { SessionListItem } from "../components/SessionListItem";
import { SearchHeader } from "../components/session-search/SearchControls";
import { SearchFilterSheet } from "../components/session-search/SearchFilterSheet";
import { SearchScopeFilters } from "../components/session-search/SearchScopeFilters";
import {
  SearchSelection,
  SelectionManager,
} from "../components/session-search/SearchSelection";
import { SearchStatusLine } from "../components/session-search/SearchStatusLine";
import {
  FiltersButton,
  SearchChips,
} from "../components/session-search/SearchToolbar";
import {
  SearchPreviews,
  SearchZoomPreview,
  SearchDiagnostics,
  type SearchPreviewTarget,
} from "../components/session-search/SearchPreviews";
import {
  chipStatuses,
  countActiveFilters,
  durationMs,
  inTimeRange,
  matchesStatus,
  statuses,
  titleMatches,
  type SearchField,
  type SearchStatus,
  type TimeBasis,
} from "../components/session-search/model";
import { useContentSearch } from "../components/session-search/useContentSearch";
import { SearchTitle } from "../components/session-search/SearchTitle";
import { SearchSessionMatches } from "../components/session-search/SearchSessionMatches";
import {
  searchNeedles,
  useSearchIntersection,
} from "../components/session-search/useSearchIntersection";
import styles from "./GlobalSessionsPage.module.css";
import { useGlobalSessionsFeed } from "../hooks/useGlobalSessionsFeed";
import { useHideAutomationSessions } from "../hooks/useHideAutomationSessions";
import { useProjectQueues } from "../hooks/useProjectQueues";
import { useProcesses } from "../hooks/useProcesses";
import { useProviders } from "../hooks/useProviders";
import { usePublicShareStatus } from "../hooks/usePublicShareStatus";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useServerSettings } from "../hooks/useServerSettings";
import { useSheetDeferredSearchParams } from "../hooks/useSheetDeferredSearchParams";
import { useSessionRightPaneSetting } from "../hooks/useSessionRightPaneSetting";
import { useVersion } from "../hooks/useVersion";
import { useModalBackGesture } from "../components/ui/Modal";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { setNewSessionPrefill } from "../lib/newSessionPrefill";
import { groupProjectsForFilter } from "../lib/projectFilterOptions";
import {
  effectiveLaunchSource,
  isAutomationLaunchSource,
  isHiddenAutomation,
  parseLaunchSourceParam,
} from "../lib/launchSource";
import { serverSupportsProjectQueue } from "../lib/projectQueueVisibility";
import { sessionCollectionRecordsToGlobalSessionItems } from "../lib/sessionCollectionRecords";
import {
  useClientSummarySourceKey,
  useDraftSessionIds,
  useProjectQueuedSessionIds,
  useSessionCollectionQueryRecords,
} from "../lib/clientSummaryStore";
import { getSessionDisplayTitle } from "../utils";

const EMPTY_PROJECTS: readonly string[] = [];
/** URL parameters the scope dropdowns own. */
const SCOPE_PARAMS = ["project", "provider", "source", "executor", "created"];
const EMPTY_IDS: ReadonlySet<string> = new Set();

interface SearchHistoryControls {
  sourceKey: string;
  fields: SearchField[];
  basis: TimeBasis;
  young: string;
  old: string;
  limit: string;
  selected: string[];
  onlySelected?: boolean;
  intersection?: boolean;
}

export function GlobalSessionsPage() {
  const sourceKey = useClientSummarySourceKey();
  return <SessionSearchPage key={sourceKey} />;
}

function SessionSearchPage() {
  const { t } = useI18n();
  const runtime = useCurrentSourceRuntime();
  const api = useMemo(
    () => createSessionApi(runtime.transport.fetch.bind(runtime.transport)),
    [runtime],
  );
  const { openSidebar, isWideScreen, setRightPaneExpanded } =
    useNavigationLayout();
  const { sessionRightPaneEnabled } = useSessionRightPaneSetting();
  const [detailHost, setDetailHost] = useState<HTMLDivElement | null>(null);
  const basePath = useRemoteBasePath();
  const navigate = useNavigate();
  const sourceKey = useClientSummarySourceKey();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [params, setParams] = useSheetDeferredSearchParams(filtersOpen);
  const location = useLocation();
  const [remembered] = useState(() => {
    const state = window.history.state?.vibeAllDaySessionSearch as
      | SearchHistoryControls
      | undefined;
    return state?.sourceKey === sourceKey ? state : undefined;
  });
  const { settings } = useServerSettings();
  const { version } = useVersion();
  const { providers: providerInfo } = useProviders();
  const turnSearchProviders = useMemo(
    () =>
      new Set(
        ALL_PROVIDERS.filter((name) =>
          providerSupportsBoundedTurnSearch(
            name,
            providerInfo.find((provider) => provider.name === name)
              ?.supportsBoundedTurnSearch,
          ),
        ),
      ),
    [providerInfo],
  );
  const supported = serverHasCapability(
    version,
    SESSION_CONTENT_SEARCH_CAPABILITY,
  );
  const creationProvenanceAvailable = serverHasCapability(
    version,
    SESSION_CREATION_PROVENANCE_CAPABILITY,
  );
  const publicShareManagementAvailable = serverHasCapability(
    version,
    PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  );
  const { status: publicShareStatus } = usePublicShareStatus({
    poll: settings?.publicSharesEnabled ?? false,
  });
  const { processes, terminatedProcesses } = useProcesses();
  const children = useMemo(
    () =>
      new Map(
        [...processes, ...terminatedProcesses]
          .filter((p) => p.providerChildren?.length)
          .map((p) => [p.sessionId, p.providerChildren]),
      ),
    [processes, terminatedProcesses],
  );
  const query = params.get("q") ?? "";
  const [intersection, setIntersection] = useState(
    remembered?.intersection ?? true,
  );
  const needles = useMemo(
    () => searchNeedles(query, intersection),
    [query, intersection],
  );
  const firstNeedle = needles[0] ?? "";
  const project = params.get("project") ?? "";
  const providerParam = params.get("provider") ?? "";
  const executorParam = params.get("executor") ?? "";
  const createdParam = params.get("created") ?? "";
  const sourceParam = params.get("source") ?? "";
  const launchSources = useMemo(
    () => parseLaunchSourceParam(sourceParam),
    [sourceParam],
  );
  const { hideAutomationSessions, setHideAutomationSessions } =
    useHideAutomationSessions();
  const statusParam = params.get("status") ?? "unarchived";
  const providers = useMemo(
    () =>
      providerParam
        .split(",")
        .filter((p): p is ProviderName =>
          ALL_PROVIDERS.includes(p as ProviderName),
        ),
    [providerParam],
  );
  const executors = useMemo(
    () => executorParam.split(",").filter(Boolean),
    [executorParam],
  );
  const created = useMemo(
    () =>
      createdParam
        .split(",")
        .filter((value) => ["web", "desktop", "unspecified"].includes(value)),
    [createdParam],
  );
  const filters = useMemo(
    () =>
      statusParam
        .split(",")
        .filter((s): s is SearchStatus =>
          (statuses as readonly string[]).includes(s),
        ),
    [statusParam],
  );
  const [fields, setFields] = useState<SearchField[]>(
    remembered?.fields ?? ["title"],
  );
  const effectiveFields = useMemo(
    () => (supported ? fields : fields.filter((f) => f === "title")),
    [fields, supported],
  );
  const [basis, setBasis] = useState<TimeBasis>(
    remembered?.basis ?? "activity",
  );
  const [young, setYoung] = useState(
    remembered?.young ?? params.get("age") ?? "",
  );
  const [old, setOld] = useState(remembered?.old ?? "");
  const [limit, setLimit] = useState(remembered?.limit ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(remembered?.selected),
  );
  const [onlySelected, setOnlySelected] = useState(
    remembered?.onlySelected ?? false,
  );
  // An empty selection cannot restrict anything, so the toggle waits for one.
  const withinSelection = onlySelected && selected.size > 0;
  const controls = useMemo<SearchHistoryControls>(
    () => ({
      sourceKey,
      fields,
      basis,
      young,
      old,
      limit,
      selected: [...selected],
      onlySelected,
      intersection,
    }),
    [
      sourceKey,
      fields,
      basis,
      young,
      old,
      limit,
      selected,
      onlySelected,
      intersection,
    ],
  );
  const rememberControls = useCallback(() => {
    if (window.history.state?.key !== location.key) return;
    window.history.replaceState(
      { ...window.history.state, vibeAllDaySessionSearch: controls },
      "",
    );
  }, [controls, location.key]);
  useLayoutEffect(rememberControls, [rememberControls]);
  // A sheet owns a same-page history entry while open. Closing it pops that
  // entry, and the entry underneath never saw the choices made meanwhile.
  useEffect(() => {
    window.addEventListener("popstate", rememberControls);
    return () => window.removeEventListener("popstate", rememberControls);
  }, [rememberControls]);
  const [manage, setManage] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [zoomed, setZoomed] = useState<SearchPreviewTarget>();
  const [expanded, setExpanded] = useState<SearchPreviewTarget["session"]>();
  const paneOpen = sessionRightPaneEnabled && !!(zoomed || expanded);
  // One history owner survives switching between the match list and a turn.
  useModalBackGesture(() => {
    setZoomed(undefined);
    setExpanded(undefined);
  }, paneOpen);
  useEffect(() => {
    setRightPaneExpanded?.(paneOpen);
    return () => setRightPaneExpanded?.(false);
  }, [paneOpen, setRightPaneExpanded]);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const changeParam = useCallback(
    (key: string, value: string) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value || key === "status") next.set(key, value);
        else next.delete(key);
        return next;
      }),
    [setParams],
  );
  const onQuery = useCallback(
    (value: string) => changeParam("q", value),
    [changeParam],
  );

  // Keep the catalog independent of filters so hidden selections remain actionable.
  const feed = useGlobalSessionsFeed({
    includeArchived: true,
    includeStats: true,
    limit: 500,
  });
  const records = useSessionCollectionQueryRecords(feed.query);
  const sessions = useMemo(
    () => sessionCollectionRecordsToGlobalSessionItems(records),
    [records],
  );
  const projectGroups = useMemo(
    () => groupProjectsForFilter(feed.projects, sessions, Date.now()),
    [feed.projects, sessions],
  );
  useCompleteSessionCatalog(feed, records.length);
  const min = durationMs(young, 0),
    max = durationMs(old, Infinity);
  const invalidRange = !Number.isFinite(min) || Number.isNaN(max) || min > max;
  const invalidLimit = limit !== "" && !/^[1-9]\d*$/.test(limit);
  const bounds = useMemo(() => {
    const now = Date.now();
    return {
      after: Number.isFinite(max) ? now - max : undefined,
      before: min > 0 ? now - min : undefined,
    };
  }, [min, max]);
  const exclusions = useMemo(
    () =>
      new Map(
        sessions.map((s) => {
          const reasons: string[] = [];
          if (withinSelection && !selected.has(s.id))
            reasons.push(t("sessionSearchOutsideSelection"));
          if (project && s.projectId !== project)
            reasons.push(t("sessionSearchOutsideProject"));
          if (providers.length && !providers.includes(s.provider))
            reasons.push(t("sessionSearchOutsideProvider"));
          // An explicit source choice overrides the hide-automation default.
          if (launchSources.length) {
            if (!launchSources.includes(effectiveLaunchSource(s)))
              reasons.push(t("sessionSearchOutsideSource"));
          } else if (isHiddenAutomation(s, hideAutomationSessions)) {
            reasons.push(t("sessionSearchHiddenAutomation"));
          }
          if (executors.length && !executors.includes(s.executor ?? "local"))
            reasons.push(t("sessionSearchOutsideExecutor"));
          if (
            creationProvenanceAvailable &&
            created.length &&
            !created.includes(s.creationProvenance?.surface ?? "unspecified")
          )
            reasons.push(t("sessionSearchOutsideCreation"));
          for (const status of filters) {
            if (!matchesStatus(s, status))
              reasons.push(
                t("sessionSearchOutsideStatus", {
                  status: t(`sessionSearchStatus_${status}`),
                }),
              );
          }
          if (
            basis !== "turns" &&
            !inTimeRange(
              basis === "created" ? s.createdAt : s.updatedAt,
              bounds.after,
              bounds.before,
            )
          )
            reasons.push(t("sessionSearchOutsideTime"));
          return [s.id, reasons];
        }),
      ),
    [
      sessions,
      withinSelection,
      selected,
      project,
      providers,
      launchSources,
      hideAutomationSessions,
      executors,
      created,
      creationProvenanceAvailable,
      filters,
      basis,
      bounds,
      t,
    ],
  );
  const candidates = useMemo(
    () => sessions.filter((s) => !exclusions.get(s.id)?.length),
    [sessions, exclusions],
  );
  const sourceCounts = useMemo(() => {
    const counts = new Map<ReturnType<typeof effectiveLaunchSource>, number>();
    for (const s of sessions) {
      const source = effectiveLaunchSource(s);
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
    return counts;
  }, [sessions]);
  const automationCount = useMemo(
    () =>
      [...sourceCounts].reduce(
        (sum, [source, count]) =>
          isAutomationLaunchSource(source) ? sum + count : sum,
        0,
      ),
    [sourceCounts],
  );
  const [viewportRows, setViewportRows] = useState(Infinity);
  const contentCandidates = useMemo(
    () =>
      candidates
        .filter((session) => turnSearchProviders.has(session.provider))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [candidates, turnSearchProviders],
  );
  const resultList = useRef<HTMLUListElement>(null);
  const acquisition = useContentSearch(
    contentCandidates,
    firstNeedle,
    effectiveFields,
    supported && !invalidRange,
    basis === "turns" ? bounds.after : undefined,
    basis === "turns" ? bounds.before : undefined,
    viewportRows,
  );
  const filtered = useSearchIntersection(acquisition.matches, needles);
  const partial = useMemo(() => {
    if (!filtered.incomplete?.size) return acquisition.partial;
    const reasons = new Map(acquisition.partial);
    for (const id of filtered.incomplete)
      reasons.set(id, t("sessionSearchIntersectionIncomplete"));
    return reasons;
  }, [acquisition.partial, filtered.incomplete, t]);
  const scan = {
    ...acquisition,
    partial,
    matches: filtered.matches,
    running: acquisition.running || filtered.filtering,
  };
  const discoveryOrder = useRef(new Map<string, number>());
  const orderedNeedle = useRef(query);
  const results = useMemo(() => {
    // Rank is first sighting under the current needle: rows stay put while a
    // scan streams in, and a new needle starts ranking again from catalog
    // order instead of replaying where each session happened to appear first
    // under some earlier search.
    if (orderedNeedle.current !== query) {
      orderedNeedle.current = query;
      discoveryOrder.current = new Map();
    }
    const found = invalidRange
      ? []
      : candidates.flatMap((session) => {
          const turns = scan.matches.get(session.id) ?? [];
          const titles = effectiveFields.includes("title")
            ? titleMatches(
                session,
                firstNeedle,
                basis === "turns" ? bounds.after : undefined,
                basis === "turns" ? bounds.before : undefined,
                needles.slice(1),
              )
            : [];
          const matches = [...titles, ...turns];
          return !query.trim() || matches.length ? [{ session, matches }] : [];
        });
    for (const result of found)
      if (!discoveryOrder.current.has(result.session.id))
        discoveryOrder.current.set(
          result.session.id,
          discoveryOrder.current.size,
        );
    return found.sort(
      (a, b) =>
        discoveryOrder.current.get(a.session.id)! -
        discoveryOrder.current.get(b.session.id)!,
    );
  }, [
    invalidRange,
    candidates,
    scan.matches,
    effectiveFields,
    query,
    firstNeedle,
    needles,
    basis,
    bounds,
  ]);
  const shownIds = useMemo(
    () => new Set(results.map(({ session }) => session.id)),
    [results],
  );
  const drafts = useDraftSessionIds();
  const projectIds = useMemo(
    () => [...new Set(results.map(({ session }) => session.projectId))],
    [results],
  );
  const queueSupported = serverSupportsProjectQueue(version);
  useProjectQueues(queueSupported ? projectIds : EMPTY_PROJECTS);
  const queuedIds = useProjectQueuedSessionIds(
    queueSupported ? projectIds : EMPTY_PROJECTS,
  );
  const queues = queueSupported ? queuedIds : EMPTY_IDS;

  const select = useCallback(
    (id: string, checked: boolean) =>
      setSelected((previous) => {
        const next = new Set(previous);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const selectedSessions = useMemo(
    () => sessions.filter((session) => selected.has(session.id)),
    [sessions, selected],
  );
  const apply = async (action: SearchStatus) => {
    if (pending || !selected.size) return;
    setPending(true);
    setActionError(undefined);
    try {
      const ids = [...selected];
      for (let offset = 0; offset < ids.length; offset += 8) {
        await Promise.all(
          ids.slice(offset, offset + 8).map((id) => {
            switch (action) {
              case "archived":
                return api.updateSessionMetadata(id, { archived: true });
              case "unarchived":
                return api.updateSessionMetadata(id, { archived: false });
              case "starred":
                return api.updateSessionMetadata(id, { starred: true });
              case "unstarred":
                return api.updateSessionMetadata(id, { starred: false });
              case "read":
                return api.markSessionSeen(id);
              case "unread":
                return api.markSessionUnread(id);
              default:
                throw new Error(`Unknown session status: ${action}`);
            }
          }),
        );
      }
      setSelected(new Set());
      await feed.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };
  const activeProject = feed.projects.find((p) => p.id === project);
  const startSession = () => {
    if (!project) return;
    if (query.trim()) setNewSessionPrefill(sourceKey, query.trim());
    navigate(
      `${basePath}/new-session?projectId=${encodeURIComponent(project)}`,
    );
  };
  const progress = scan.running || feed.loading || feed.hasMore;
  const limitNumber = !limit || invalidLimit ? Infinity : Number(limit);
  const layoutKey = query;
  const [compactedSearch, setCompactedSearch] = useState<string>();
  const hasTurnFields = effectiveFields.some((field) => field !== "title");
  const updateFields = useCallback(
    (next: SearchField[]) => {
      setFields(next);
      if (!scan.running && scan.scanned > 0) setCompactedSearch(query);
    },
    [scan.running, scan.scanned, query],
  );
  const streamingLayout =
    hasTurnFields && !!query.trim() && compactedSearch !== layoutKey;
  const activeFilterCount = countActiveFilters({
    fields: effectiveFields,
    intersection,
    basis,
    young,
    old,
    limit,
    project,
    providers,
    sources: launchSources,
    executors,
    created: creationProvenanceAvailable ? created : [],
    statuses: filters,
  });
  const narrowed =
    !!query.trim() ||
    activeFilterCount > 0 ||
    filters.some((status) =>
      (chipStatuses as readonly string[]).includes(status),
    );
  const clearFilters = (includeQuery: boolean) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const key of [...SCOPE_PARAMS, "status", "age"]) next.delete(key);
      if (includeQuery) next.delete("q");
      return next;
    });
    setFields(["title"]);
    setIntersection(true);
    setBasis("activity");
    setYoung("");
    setOld("");
    setLimit("");
  };
  const selectionMode = selecting || selected.size > 0;
  const setSelectionMode = (next: boolean) => {
    if (next) {
      setSelecting(true);
      return;
    }
    setSelecting(false);
    setSelected(new Set());
    setOnlySelected(false);
  };
  const contentSearch = hasTurnFields && !!query.trim();
  const limitAnchor = useRef<{ element: HTMLElement; top: number } | undefined>(
    undefined,
  );
  const adjustLimit = (delta: number, shown: number, element: HTMLElement) => {
    limitAnchor.current = { element, top: element.getBoundingClientRect().top };
    setLimit(
      String(
        Math.max(
          1,
          (Number.isFinite(limitNumber) ? limitNumber : shown) + delta,
        ),
      ),
    );
    setCompactedSearch(layoutKey);
  };
  useLayoutEffect(() => {
    const anchor = limitAnchor.current;
    limitAnchor.current = undefined;
    const scroller = anchor?.element.closest(".page-scroll-container");
    if (anchor && scroller)
      scroller.scrollTop +=
        anchor.element.getBoundingClientRect().top - anchor.top;
  });
  useEffect(
    () =>
      setCompactedSearch((previous) =>
        previous === layoutKey ? undefined : previous,
      ),
    [layoutKey],
  );
  // Expansion out of the initial streaming shape waits for the scan to finish
  // and for input to go quiet. Completion is re-checked when the quiet period
  // elapses rather than gating entry to this effect: a needle refinement
  // starts a scan, so gating on `scan.running` meant the effect bailed at the
  // moment the needle changed, and the run that would have armed the timer
  // afterwards never arrived. The rows then stayed clamped to one preview per
  // role for good, however long the reader waited (fixed 2026-09-17; the
  // "refines cached turns" browser checks cover it).
  //
  // The quiet period is also measured from completion, not from whenever the
  // timer last happened to be armed. `scan.running` is a dependency again —
  // without the early return that caused the clamp — so a scan finishing
  // rearms a full 500ms. Otherwise a timer armed mid-scan could come due a few
  // milliseconds after the last match arrived and reflow the row in the same
  // breath, which is exactly the "completion alone does not immediately
  // reflow" case the reserved streaming height exists to cover (fixed
  // 2026-09-18; the "reserves arriving matches" browser checks cover it).
  const scanRunning = useRef(scan.running);
  scanRunning.current = scan.running;
  useEffect(() => {
    scanRunning.current = scan.running;
    if (!hasTurnFields || compactedSearch === layoutKey) return;
    let timer: ReturnType<typeof setTimeout>;
    const settle = () => {
      // Still acquiring: wait out another quiet period instead of expanding
      // mid-scan, which is what the streaming shape exists to avoid.
      if (scanRunning.current) {
        idle();
        return;
      }
      startTransition(() => setCompactedSearch(layoutKey));
    };
    const idle = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 500);
    };
    idle();
    window.addEventListener("pointermove", idle);
    window.addEventListener("keydown", idle);
    window.addEventListener("wheel", idle);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", idle);
      window.removeEventListener("keydown", idle);
      window.removeEventListener("wheel", idle);
    };
  }, [scan.running, layoutKey, compactedSearch, hasTurnFields]);
  const [renderWindow, setRenderWindow] = useState({ query, count: 40 });
  const renderedCount = renderWindow.query === query ? renderWindow.count : 40;
  const more = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!results.length) return;
    const list = resultList.current;
    const row = list?.firstElementChild;
    const main = list?.closest("main");
    if (!list || !row || !main || !streamingLayout) return;
    const measure = () => {
      const height =
        row.getBoundingClientRect().height +
        Number.parseFloat(getComputedStyle(list).rowGap);
      const space =
        main.getBoundingClientRect().bottom - list.getBoundingClientRect().top;
      if (height > 0) setViewportRows(Math.max(1, Math.ceil(space / height)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(main);
    return () => observer.disconnect();
  }, [streamingLayout, results.length]);
  const showMore = useCallback(
    () =>
      startTransition(() =>
        setRenderWindow((previous) => ({
          query,
          count: (previous.query === query ? previous.count : 40) + 40,
        })),
      ),
    [query],
  );
  useEffect(() => {
    if (results.length <= renderedCount) return;
    const element = more.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) showMore();
      },
      { root: element.closest("main"), rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [showMore, renderedCount, results.length]);
  const scopeFilters = (
    <SearchScopeFilters
      sessions={sessions}
      projectGroups={projectGroups}
      project={project}
      providers={providers}
      launchSources={launchSources}
      executors={executors}
      created={created}
      executorCounts={feed.stats.executorCounts}
      sourceCounts={sourceCounts}
      automationCount={automationCount}
      hideAutomation={hideAutomationSessions}
      onHideAutomation={setHideAutomationSessions}
      supported={supported}
      turnSearchProviders={turnSearchProviders}
      creationProvenanceAvailable={creationProvenanceAvailable}
      onChange={changeParam}
    />
  );
  const setStatuses = (next: SearchStatus[]) =>
    changeParam("status", next.join(","));
  // Why a session is not among the shown results; empty when it is.
  const describeHidden = (session: (typeof sessions)[number]) =>
    shownIds.has(session.id)
      ? undefined
      : exclusions.get(session.id)?.join("; ") ||
        (invalidRange
          ? t("sessionSearchInvalidRange")
          : !effectiveFields.length
            ? t("sessionSearchChooseField")
            : (scan.partial.get(session.id) ??
              scan.error ??
              t(
                scan.running
                  ? "sessionSearchNotFoundYet"
                  : "sessionSearchNoTextMatch",
              )));
  return (
    <MainContent
      isWideScreen={isWideScreen}
      innerClassName={paneOpen ? styles.withDetail : undefined}
    >
      <PageHeader
        title={t("tabSessions")}
        description={t("consoleSessionsDescription")}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <SessionViews />
      <main className="page-scroll-container">
        <div
          className={`page-content-inner ${styles.page}${
            selected.size ? ` ${styles.withBulkBar}` : ""
          }`}
        >
          <div className={styles.sticky}>
            <SearchHeader
              query={query}
              onQuery={onQuery}
              onFields={updateFields}
              supported={supported}
              supportKnown={version !== null && version !== undefined}
              trailing={
                <FiltersButton
                  count={activeFilterCount}
                  onClick={() => setFiltersOpen(true)}
                />
              }
            />
            <SearchChips
              filters={filters}
              onFilters={setStatuses}
              selecting={selectionMode}
              onSelecting={setSelectionMode}
            />
          </div>
          <div className={styles.stack}>
            <div className={styles.meta}>
              <SearchStatusLine
                sessionCount={
                  effectiveFields.includes("title")
                    ? candidates.length
                    : effectiveFields.length
                      ? contentCandidates.length
                      : 0
                }
                scanning={scan.running}
                acquiring={scan.acquiring || feed.loading || feed.hasMore}
                status={
                  scan.running
                    ? t("sessionSearchProgress", {
                        count: scan.scanned,
                        total: contentCandidates.length,
                      })
                    : scan.limited
                      ? t("sessionSearchCapped", { count: scan.limited })
                      : feed.loading || feed.hasMore
                        ? t("sessionSearchLoadingCatalog")
                        : t("sessionSearchWatching")
                }
              />
            </div>
            {selectionMode && (
              <SearchSelection
                count={selected.size}
                shown={results.length}
                allShownSelected={results.every(({ session }) =>
                  selected.has(session.id),
                )}
                onSelectShown={() =>
                  setSelected((previous) => new Set([...previous, ...shownIds]))
                }
                onClear={() => setSelected(new Set())}
                onlySelected={onlySelected}
                onOnlySelected={setOnlySelected}
                onManage={() => setManage(true)}
                pending={pending}
              />
            )}
            {activeProject && (
              <div
                className={`global-sessions-project-cta ${styles.projectCta}`}
              >
                <div className={styles.projectCtaCopy}>
                  <strong>
                    {t("sidebarNewSession")}{" "}
                    <code className="global-sessions-project-cta__token">
                      {activeProject.name}
                    </code>
                  </strong>
                  <span>
                    {query.trim()
                      ? t("globalSessionsProjectCtaPromptLabel")
                      : t("globalSessionsProjectCtaHint")}{" "}
                    <code className="global-sessions-project-cta__token">
                      {query.trim() || activeProject.name}
                    </code>
                  </span>
                </div>
                <Button variant="primary" onClick={startSession}>
                  {t("sidebarNewSession")}
                </Button>
              </div>
            )}
            {invalidRange && (
              <p role="alert" className={styles.error}>
                {t("sessionSearchInvalidRange")}
              </p>
            )}
            {!effectiveFields.length && query.trim() && (
              <p role="status" className={styles.progress}>
                {t("sessionSearchChooseField")}
              </p>
            )}
            {invalidLimit && (
              <p role="alert" className={styles.error}>
                {t("sessionSearchInvalidLimit")}
              </p>
            )}
            {(feed.error || scan.error || actionError) && (
              <p role="alert" className={styles.error}>
                {feed.error?.message ?? scan.error ?? actionError}
              </p>
            )}
            {progress && !sessions.length && !feed.error && (
              <LoadingState label={t("sessionSearchLoadingCatalog")} />
            )}
            {!progress && !feed.error && !scan.error && !results.length && (
              <EmptyState
                title={t("globalSessionsNoResultsTitle")}
                hint={
                  narrowed
                    ? t("globalSessionsNoResultsFiltered")
                    : t("globalSessionsNoResultsEmpty")
                }
                action={
                  narrowed ? (
                    <Button
                      variant="secondary"
                      onClick={() => clearFilters(true)}
                    >
                      {t("globalSessionsClearFilters")}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => navigate(`${basePath}/new-session`)}
                    >
                      {t("nowStartSession")}
                    </Button>
                  )
                }
              />
            )}
          </div>
          <ul
            ref={resultList}
            className={`${styles.results}${selectionMode ? ` ${styles.selecting}` : ""}`}
          >
            {results.slice(0, renderedCount).map(({ session, matches }) => (
              <SessionListItem
                key={session.id}
                sessionId={session.id}
                projectId={session.projectId}
                title={getSessionDisplayTitle(session)}
                // Only a needle needs the one-line excerpt around its match;
                // otherwise the card keeps its two-line serif title.
                titleContent={
                  firstNeedle && effectiveFields.includes("title") ? (
                    <SearchTitle
                      text={
                        matches.find((match) => match.role === "title")
                          ?.fullText ?? getSessionDisplayTitle(session)
                      }
                      query={firstNeedle}
                    />
                  ) : undefined
                }
                fullTitle={session.fullTitle ?? getSessionDisplayTitle(session)}
                initialPrompt={session.initialPrompt}
                hasCustomTitle={!!session.customTitle}
                lastAgentText={session.lastAgentText}
                updatedAt={session.updatedAt}
                createdAt={session.createdAt}
                hasUnread={session.hasUnread}
                activity={session.activity}
                pendingInputType={session.pendingInputType}
                status={session.ownership}
                provider={session.provider}
                model={session.model}
                parentSessionId={session.parentSessionId}
                parentSessionKind={session.parentSessionKind}
                providerChildren={
                  children.get(session.id) ?? session.providerChildren
                }
                isStarred={session.isStarred}
                isArchived={session.isArchived}
                mode="card"
                isSelected={selected.has(session.id)}
                onSelect={select}
                showProjectName={!project}
                projectName={session.projectName}
                basePath={basePath}
                messageCount={session.messageCount}
                hasDraft={drafts.has(session.id)}
                hasProjectQueue={queues.has(session.id)}
                publicShareCreationReady={publicShareStatus?.canCreate ?? false}
                publicShareManagementAvailable={publicShareManagementAvailable}
                openMessageId={matches.find((m) => m.role !== "title")?.id}
                // Previews turn a row into a compact search row; without a
                // turn search it stays the Garden card.
                searchPreviews={
                  contentSearch ? (
                    <SearchPreviews
                      onExpand={() => setExpanded(session)}
                      limit={limitNumber}
                      onAdjustLimit={adjustLimit}
                      session={session}
                      matches={matches}
                      streamingRows={
                        streamingLayout &&
                        turnSearchProviders.has(session.provider)
                          ? Math.min(
                              Number.isFinite(limitNumber) ? limitNumber : 1,
                              effectiveFields.filter(
                                (field) => field !== "title",
                              ).length,
                            )
                          : 0
                      }
                      query={firstNeedle}
                      basePath={basePath}
                      onZoom={setZoomed}
                    />
                  ) : undefined
                }
              />
            ))}
          </ul>
          {results.length > renderedCount && (
            <button
              ref={more}
              className={styles.more}
              type="button"
              onClick={showMore}
            >
              {t("sessionSearchMore")}
            </button>
          )}
          <div className={styles.footer}>
            <SearchDiagnostics
              sessions={sessions}
              partial={scan.partial}
              diagnostics={scan.diagnostics}
              basePath={basePath}
            />
          </div>
          {!supported && (
            <p className={styles.note}>{t("sessionSearchUpgrade")}</p>
          )}
        </div>
        <BulkActionBar
          selectedCount={selected.size}
          onArchive={() => apply("archived")}
          onUnarchive={() => apply("unarchived")}
          onStar={() => apply("starred")}
          onUnstar={() => apply("unstarred")}
          onMarkRead={() => apply("read")}
          onMarkUnread={() => apply("unread")}
          onClearSelection={() => setSelected(new Set())}
          isPending={pending}
          canArchive={selectedSessions.some((s) => !s.isArchived)}
          canUnarchive={selectedSessions.some((s) => s.isArchived)}
          canStar={selectedSessions.some((s) => !s.isStarred)}
          canUnstar={selectedSessions.some((s) => s.isStarred)}
          canMarkRead={selectedSessions.some((s) => s.hasUnread)}
          canMarkUnread={selectedSessions.some((s) => !s.hasUnread)}
        />
      </main>
      {filtersOpen && (
        <SearchFilterSheet
          onClose={() => setFiltersOpen(false)}
          onClear={() => clearFilters(false)}
          resultCount={results.length}
          activeCount={activeFilterCount}
          fields={effectiveFields}
          onFields={updateFields}
          supported={supported}
          intersection={intersection}
          onIntersection={setIntersection}
          basis={basis}
          onBasis={setBasis}
          young={young}
          old={old}
          onYoung={setYoung}
          onOld={setOld}
          limit={limit}
          onLimit={setLimit}
          showLimit={hasTurnFields}
          statuses={filters}
          onStatuses={setStatuses}
          scope={scopeFilters}
        />
      )}
      {manage && (
        <SelectionManager
          sessions={sessions}
          selected={selected}
          listed={(session) => turnSearchProviders.has(session.provider)}
          describe={describeHidden}
          onToggle={select}
          onClose={() => setManage(false)}
        />
      )}
      {paneOpen && <div ref={setDetailHost} className={styles.detailHost} />}
      {expanded && !(paneOpen && zoomed) && (!paneOpen || detailHost) && (
        <SearchSessionMatches
          session={
            sessions.find((session) => session.id === expanded.id) ?? expanded
          }
          matches={
            results.find(({ session }) => session.id === expanded.id)
              ?.matches ?? []
          }
          query={firstNeedle}
          running={scan.running}
          limited={scan.limitedSessions.has(expanded.id)}
          partial={scan.partial}
          diagnostics={scan.diagnostics}
          basePath={basePath}
          onZoom={setZoomed}
          paneTarget={paneOpen ? detailHost : undefined}
          onClose={() => setExpanded(undefined)}
        />
      )}
      {zoomed && (!paneOpen || detailHost) && (
        <SearchZoomPreview
          target={zoomed}
          paneTarget={paneOpen ? detailHost : undefined}
          query={firstNeedle}
          basePath={basePath}
          onClose={() => setZoomed(undefined)}
        />
      )}
    </MainContent>
  );
}
