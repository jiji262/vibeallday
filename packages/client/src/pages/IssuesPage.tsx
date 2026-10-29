import type {
  IssueItem,
  IssueSort,
  IssueSearchResult,
  IssueSessionsResult,
} from "@vibeallday/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/garden/Button";
import { Card, CardFooter } from "../components/garden/Card";
import { EmptyState } from "../components/garden/EmptyState";
import { SearchField, selectClassName } from "../components/garden/Field";
import { BugIcon, RefreshIcon, SettingsIcon } from "../components/garden/icons";
import { ListToolbar } from "../components/garden/ListToolbar";
import { Notice } from "../components/garden/Notice";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useSourceContextMenu } from "../components/SourceContextMenu";
import { useCurrentSourceRuntime } from "../contexts/SourceRuntimeContext";
import { useIssuesEnabled } from "../hooks/useIssuesEnabled";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { IssueDetailPane } from "./IssueDetailPane";
import { type IssueEditKind, IssueListRow } from "./IssueListRow";
import styles from "./IssuesPage.module.css";

/** Page size the server uses for issue results. */
const ISSUE_PAGE_SIZE = 50;

export function IssuesPage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const enabled = useIssuesEnabled();
  const runtime = useCurrentSourceRuntime();
  const [scopeParams] = useSearchParams();
  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("issuesTitle")}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          {enabled ? (
            <IssueBrowser
              key={`${runtime.sourceKey}:${scopeParams.toString()}`}
            />
          ) : (
            <>
              <IssuesIntro />
              <EmptyState
                title={t("issuesDisabledTitle")}
                hint={t("issuesDisabled")}
                icon={<BugIcon />}
              />
            </>
          )}
        </div>
      </main>
    </MainContent>
  );
}

function IssuesIntro() {
  const { t } = useI18n();
  const base = useRemoteBasePath();
  return (
    <PageIntro
      eyebrow={[t("sidebarGroupTools")]}
      title={t("issuesTitle")}
      lede={t("issuesLede")}
      actions={
        <Link className={styles.settingsLink} to={`${base}/settings/issues`}>
          <SettingsIcon size={16} />
          {t("issuesSettings")}
        </Link>
      }
    />
  );
}

function IssueBrowser() {
  const { t } = useI18n();
  const { transport } = useCurrentSourceRuntime();
  const base = useRemoteBasePath();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [result, setResult] = useState<IssueSearchResult>();
  const [selected, setSelected] = useState<IssueItem>();
  const [detail, setDetail] = useState<IssueSessionsResult>();
  // The dismissed filter `detail` was fetched under; the checkbox can change
  // before its replacement arrives.
  const [detailIncludesDismissed, setDetailIncludesDismissed] = useState(false);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [sort, setSort] = useState("activity");
  const [issueSort, setIssueSort] = useState<IssueSort>("activity");
  const supportedIssueSort =
    result?.supportedSorts?.includes(issueSort) ?? false;
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{
    item: IssueItem;
    kind: IssueEditKind;
  }>();
  const [value, setValue] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const sessionId = params.get("sessionId") ?? "";
  const projectId = params.get("projectId") ?? "";
  const menu = useSourceContextMenu(t, {
    menu: t("issuesItemActions"),
    dismiss: t("issuesCancel"),
  });
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Tracker states arrive shortly after the read that asked for them.
    let statusRechecks = 0;
    const load = async () => {
      try {
        const next = await transport.fetch<IssueSearchResult>(
          `/issues?${new URLSearchParams({ q: query, offset: String(offset), dismissed: dismissed ? "1" : "0", sessionId, projectId, revision: String(revision), ...(supportedIssueSort ? { sort: issueSort } : {}) })}`,
        );
        if (!disposed) {
          setResult(next);
          setSelected((previous) => {
            const current = next.items.find((item) => item.id === previous?.id);
            return current &&
              previous &&
              (current.title !== previous.title ||
                current.url !== previous.url ||
                current.sessionCount !== previous.sessionCount)
              ? current
              : previous;
          });
          if (next.coverage.active) timer = setTimeout(load, 750);
          else if (next.statusRefreshing && statusRechecks++ < 3)
            timer = setTimeout(load, 1500);
        }
      } catch {
        if (!disposed) setError(t("issuesLoadError"));
      }
    };
    timer = setTimeout(() => void load(), 150);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    transport,
    query,
    offset,
    dismissed,
    sessionId,
    projectId,
    revision,
    supportedIssueSort,
    issueSort,
    t,
  ]);
  useEffect(() => {
    let disposed = false;
    if (selected)
      void transport
        .fetch<IssueSessionsResult>(
          `/issues/sessions?${new URLSearchParams({ id: selected.id, offset: String(sessionOffset), sort, dismissed: dismissed ? "1" : "0", revision: String(revision) })}`,
        )
        .then((next) => {
          if (disposed) return;
          setDetail(next);
          setDetailIncludesDismissed(dismissed);
        })
        .catch(() => {
          if (!disposed) setError(t("issuesLoadError"));
        });
    return () => {
      disposed = true;
    };
  }, [transport, selected, sessionOffset, sort, dismissed, revision, t]);
  const action = async (
    path: string,
    method: string,
    body?: unknown,
    saved?: (result: { title?: string | null }) => void,
  ) => {
    setBusy(true);
    setError("");
    try {
      const response = await transport.fetch<{ title?: string | null }>(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (alive.current) {
        saved?.(response);
        setRevision((x) => x + 1);
        return true;
      }
    } catch {
      if (alive.current) setError(t("issuesSaveError"));
    } finally {
      if (alive.current) setBusy(false);
    }
    return false;
  };
  const select = (item: IssueItem) => {
    setEditing(undefined);
    setSelected(item);
    setSessionOffset(0);
    // Only picking an issue empties the pane. A refresh leaves the rows mounted
    // until the new answer arrives, so an expanded row keeps the mentions it
    // has already loaded.
    if (item.id !== selected?.id) setDetail(undefined);
  };
  const edit = (item: IssueItem, kind: IssueEditKind) => {
    if (kind === "url") select(item);
    setEditing({ item, kind });
    setValue(kind === "title" ? (item.title ?? "") : "");
  };
  const saveEdit = async () => {
    if (!editing) return;
    const { item, kind } = editing;
    let ok = false;
    if (kind === "title") {
      ok = await action(
        "/issues/item",
        "PATCH",
        { id: item.id, title: value.trim() || null },
        (response) => {
          setSelected((previous) =>
            previous?.id === item.id
              ? {
                  ...previous,
                  title:
                    response.title !== undefined
                      ? response.title
                      : value.trim() || null,
                }
              : previous,
          );
        },
      );
    } else if (kind === "delete") {
      ok = await action(
        `/issues/item?${new URLSearchParams({ id: item.id })}`,
        "DELETE",
      );
      if (ok)
        setSelected((previous) =>
          previous?.id === item.id ? undefined : previous,
        );
    } else {
      const first = detail?.sessions[0];
      if (first) {
        ok = await action("/issues/resolve", "POST", {
          url: value,
          key: item.key,
          projectId: first.projectId,
          sessionId: first.sessionId,
        });
        if (ok) setSelected(undefined);
      }
    }
    if (ok) setEditing(undefined);
  };
  const editorFor = (item: IssueItem) =>
    editing?.item.id === item.id
      ? {
          kind: editing.kind,
          value,
          onChange: setValue,
          busy,
          canResolve: Boolean(detail?.sessions.length),
          onSave: () => void saveEdit(),
          onCancel: () => setEditing(undefined),
        }
      : undefined;
  const openMenu = (
    event: Parameters<typeof menu.openFromButton>[0],
    item: IssueItem,
  ) =>
    menu.openFromButton(event, [
      {
        label: t(item.unresolved ? "issuesResolve" : "issuesEditTitle"),
        onSelect: () => edit(item, item.unresolved ? "url" : "title"),
        disabled: busy,
      },
      {
        label: t("issuesDelete"),
        onSelect: () => edit(item, "delete"),
        disabled: busy,
      },
    ]);
  const sortControl = supportedIssueSort ? (
    <select
      className={selectClassName(styles.sortSelect)}
      aria-label={t("issuesSortLabel")}
      value={issueSort}
      onChange={(e) => {
        setIssueSort(e.target.value as IssueSort);
        setOffset(0);
      }}
    >
      {result?.supportedSorts?.map((value) => (
        <option key={value} value={value}>
          {t(`issuesSort_${value}`)}
        </option>
      ))}
    </select>
  ) : (
    <span className={styles.keyOrder}>{t("issuesKeyOrder")}</span>
  );
  return (
    <>
      <IssuesIntro />
      <ListToolbar
        label={t("issuesResults")}
        search={
          <SearchField
            label={t("issuesSearch")}
            placeholder={t("issuesSearch")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        }
        filters={
          <>
            {sortControl}
            <label className={styles.choice}>
              <input
                type="checkbox"
                checked={dismissed}
                onChange={(e) => {
                  setDismissed(e.target.checked);
                  setOffset(0);
                  setSessionOffset(0);
                }}
              />
              {t("issuesShowDismissed")}
            </label>
          </>
        }
        count={
          result
            ? t("issuesResultCount", { count: result.items.length })
            : undefined
        }
        actions={
          <Button
            size="sm"
            icon={<RefreshIcon size={14} />}
            onClick={() => setRevision((x) => x + 1)}
          >
            {t("issuesRefresh")}
          </Button>
        }
      />
      <details className={styles.coverage}>
        <summary>
          {result?.coverage.active
            ? t("issuesIndexing")
            : t("issuesDiscoveryDetails")}
        </summary>
        {result && (
          <p>
            {result.coverage.settings.scope === "viewed"
              ? t("issuesViewedCoverage")
              : t("issuesRecentCoverage", {
                  days: result.coverage.settings.recentDays,
                })}
          </p>
        )}
        <div className={styles.coverageCounts}>
          {result?.coverage.counts.map((row) => (
            <span key={row.state}>
              {t(`issuesState_${row.state}` as never)}: {row.count}
            </span>
          ))}
        </div>
      </details>
      {sessionId && (
        <Notice
          className={styles.notice}
          actions={<Link to={`${base}/issues`}>{t("issuesAll")}</Link>}
        >
          {t("issuesSessionFilter")}
        </Notice>
      )}
      {error && (
        <Notice tone="danger" role="alert" className={styles.notice}>
          {error}
        </Notice>
      )}
      <div className={`${styles.columns} ${selected ? styles.withDetail : ""}`}>
        <Card
          as="section"
          flush
          className={`${styles.list} ${editing ? styles.editingList : ""}`}
          aria-label={t("issuesResults")}
        >
          <div className={styles.listHeader} aria-hidden="true">
            <span>{t("issuesColumnReference")}</span>
            <span>{t("issuesColumnSessions")}</span>
            <span>{t("issuesColumnState")}</span>
          </div>
          {result?.items.length === 0 && (
            <EmptyState compact title={t("issuesEmpty")} />
          )}
          <ul className={styles.items}>
            {result?.items.map((item) => (
              <IssueListRow
                key={item.id}
                item={item}
                selected={selected?.id === item.id}
                sort={result.sort}
                onSelect={() => select(item)}
                onMenu={(event) => openMenu(event, item)}
                editor={editorFor(item)}
              />
            ))}
          </ul>
          {(offset > 0 || result?.nextOffset != null) && (
            <CardFooter band>
              <span />
              <span className={styles.actions}>
                {offset > 0 && (
                  <Button
                    size="sm"
                    onClick={() =>
                      setOffset(Math.max(0, offset - ISSUE_PAGE_SIZE))
                    }
                  >
                    {t("issuesPrevious")}
                  </Button>
                )}
                {result?.nextOffset != null && (
                  <Button
                    size="sm"
                    onClick={() => setOffset(result.nextOffset!)}
                  >
                    {t("issuesNext")}
                  </Button>
                )}
              </span>
            </CardFooter>
          )}
        </Card>
        {selected && (
          <IssueDetailPane
            selected={selected}
            detail={detail}
            includeDismissed={detailIncludesDismissed}
            busy={busy}
            action={action}
            sort={sort}
            onSort={setSort}
            sessionOffset={sessionOffset}
            onSessionOffset={setSessionOffset}
            onClose={() => setSelected(undefined)}
          />
        )}
      </div>
      {menu.menu}
    </>
  );
}
