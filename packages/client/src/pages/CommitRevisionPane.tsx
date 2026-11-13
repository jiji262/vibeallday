import type { GitRecentCommit, GitStatusInfo } from "@vibeallday/shared";
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import {
  SourceRowMenuTrigger,
  sourceRowMenuSurface,
  type SourceContextMenuAction,
  useSourceContextMenu,
} from "../components/SourceContextMenu";
import { SearchMatchText } from "../components/SearchMatchText";
import { SourceShortcutHelp } from "../components/SourceShortcutHelp";
import { formatRemoteCheckTime } from "../hooks/useGitActions";
import { useRelativeNow } from "../hooks/useRelativeNow";
import {
  handleSourceListKeyDown,
  suppressSourceKeyboardTooltips,
} from "../hooks/useSourceKeyboard";
import { writeClipboardText } from "../lib/clipboard";
import type { CommitSearchMatch } from "../lib/commitSearchIndex";
import { findTextMatch } from "../lib/searchMatch";
import type { TranslationFn } from "../i18n";
import { WORKING_TREE_KEY } from "./useCommitBrowserModel";
import {
  CommitAuthorInitial,
  CommitGraphCell,
  HeadTag,
} from "./CommitRevisionPane.graph";
import styles from "./CommitRevisionPane.module.css";
import {
  SourcePaneEmpty,
  SourcePaneError,
  SourcePaneLoading,
} from "./SourcePaneStates";

/**
 * Commit-history master pane. It owns revision-row presentation and row menus;
 * the parent supplies the already-resolved list/search model and navigation.
 */
export function CommitRevisionPane({
  status,
  isWideScreen,
  searchInputRef,
  searchQuery,
  searchIndexRequested,
  searchIndexing,
  indexedCount,
  totalCount,
  searchError,
  searchActive,
  displayedCommits,
  commitSearchMatches,
  selectedKey,
  selectedIsWorkingTree,
  showWorkingTreeRevision,
  loadingList,
  listError,
  hasMore,
  workingTreeCommentCount,
  commentCountBySha,
  isRead,
  onSearchQueryChange,
  onSearchIndexRequested,
  onOpenRevision,
  onEnterRevision,
  revisionHref,
  onFocusRevision,
  onLoadMore,
  onMarkReadTo,
  onMarkUnreadSince,
  displayedKeys,
  t,
}: {
  status?: GitStatusInfo;
  isWideScreen: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchIndexRequested: boolean;
  searchIndexing: boolean;
  indexedCount: number;
  totalCount: number;
  searchError: string | null;
  searchActive: boolean;
  displayedCommits: GitRecentCommit[];
  commitSearchMatches: ReadonlyMap<string, CommitSearchMatch>;
  displayedKeys: string[];
  selectedKey: string | null;
  selectedIsWorkingTree: boolean;
  showWorkingTreeRevision: boolean;
  loadingList: boolean;
  listError: string | null;
  hasMore: boolean;
  workingTreeCommentCount: number;
  commentCountBySha: ReadonlyMap<string, number>;
  isRead: (authorDate: string) => boolean;
  onSearchQueryChange: (query: string) => void;
  onSearchIndexRequested: () => void;
  onOpenRevision: (key: string) => void;
  onEnterRevision: (key: string) => void;
  revisionHref: (key: string) => string;
  onFocusRevision: (key: string) => void;
  onLoadMore: () => void;
  onMarkReadTo: (authorDate: string) => void;
  onMarkUnreadSince: (authorDate: string) => void;
  t: TranslationFn;
}) {
  const revisionMenu = useSourceContextMenu(t);
  const nowMs = useRelativeNow();
  const headSha = status?.recentCommits?.[0]?.hash;
  const revisionListRef = useRef<HTMLOListElement>(null);
  const initialRevisionFocusPending = useRef(true);
  const revisionMenuActions = useCallback(
    (key: string, commit?: GitRecentCommit): SourceContextMenuAction[] => {
      const index = displayedKeys.indexOf(key);
      const newer = index > 0 ? displayedKeys[index - 1] : undefined;
      const older =
        index >= 0 && index < displayedKeys.length - 1
          ? displayedKeys[index + 1]
          : undefined;
      if (!commit) {
        return [
          {
            label: t("sourceCopyRevisionLabel"),
            onSelect: () => {
              void writeClipboardText(t("sourceWorkingTree"));
            },
          },
          {
            label: t("sourceNewerCommit"),
            disabled: !newer,
            onSelect: () => newer && onOpenRevision(newer),
          },
          {
            label: t("sourceOlderCommit"),
            disabled: !older,
            onSelect: () => older && onOpenRevision(older),
          },
        ];
      }
      return [
        {
          label: t("sourceCopyCommitHash"),
          onSelect: () => {
            void writeClipboardText(commit.hash);
          },
        },
        {
          label: t("sourceCopyCommitSubject"),
          onSelect: () => {
            void writeClipboardText(commit.subject);
          },
        },
        {
          label: t("sourceMarkReadToHere"),
          separatorBefore: true,
          onSelect: () => onMarkReadTo(commit.authorDate),
        },
        {
          label: t("sourceMarkUnreadSinceHere"),
          onSelect: () => onMarkUnreadSince(commit.authorDate),
        },
        {
          label: t("sourceNewerCommit"),
          separatorBefore: true,
          disabled: !newer,
          onSelect: () => newer && onOpenRevision(newer),
        },
        {
          label: t("sourceOlderCommit"),
          disabled: !older,
          onSelect: () => older && onOpenRevision(older),
        },
      ];
    },
    [displayedKeys, onMarkReadTo, onMarkUnreadSince, onOpenRevision, t],
  );

  const noVisibleRevisions =
    displayedCommits.length === 0 && !showWorkingTreeRevision;
  const workingTreeClean = status?.isClean === true;
  const workingTreeFileCount = status
    ? new Set(status.files.map((file) => file.path)).size
    : 0;
  const workingTreeMenuActions = revisionMenuActions(WORKING_TREE_KEY);
  const workingTreeTargetProps = revisionMenu.targetProps(
    workingTreeMenuActions,
    () => onOpenRevision(WORKING_TREE_KEY),
  );
  useLayoutEffect(() => {
    if (loadingList) {
      initialRevisionFocusPending.current = true;
      return;
    }
    if (!isWideScreen || !initialRevisionFocusPending.current || !selectedKey) {
      return;
    }
    const selectedRevision =
      revisionListRef.current?.querySelector<HTMLElement>(
        ".commit-list-item.selected",
      );
    if (!selectedRevision) return;
    initialRevisionFocusPending.current = false;
    suppressSourceKeyboardTooltips();
    selectedRevision.focus({ preventScroll: true });
  }, [isWideScreen, loadingList, selectedKey]);
  return (
    <>
      <div className="commit-list-column">
        <div className="source-search-field">
          <input
            ref={searchInputRef}
            type="search"
            className="source-search-input"
            value={searchQuery}
            placeholder={t("sourceSearchCommits")}
            aria-keyshortcuts="/"
            onFocus={onSearchIndexRequested}
            onKeyDown={(event) => {
              if (event.key === "Escape" && searchQuery) {
                event.preventDefault();
                onSearchQueryChange("");
              }
            }}
            onChange={(event) => {
              onSearchIndexRequested();
              onSearchQueryChange(event.target.value);
            }}
          />
          <kbd className="source-search-shortcut">/</kbd>
          <SourceShortcutHelp t={t} />
        </div>
        {searchIndexRequested && searchIndexing && (
          <div className="source-search-index-status">
            {totalCount > 0
              ? t("sourceIndexingCommits", {
                  indexed: indexedCount,
                  total: totalCount,
                })
              : t("sourcePreparingCommitIndex")}
          </div>
        )}
        {loadingList && !searchActive && noVisibleRevisions ? (
          <SourcePaneLoading label={t("gitStatusLoading")} />
        ) : listError && !searchActive && noVisibleRevisions ? (
          <SourcePaneError message={listError} />
        ) : searchActive && searchIndexing && noVisibleRevisions ? (
          <SourcePaneLoading label={t("sourceSearching")} />
        ) : searchActive && searchError && noVisibleRevisions ? (
          <SourcePaneError message={searchError} />
        ) : noVisibleRevisions ? (
          <SourcePaneEmpty
            title={searchActive ? t("sourceNoMatches") : t("sourceNoCommits")}
          />
        ) : (
          <>
            <ol
              ref={revisionListRef}
              className="commit-list"
              onKeyDown={handleSourceListKeyDown}
            >
              {showWorkingTreeRevision && (
                <li
                  className={`commit-list-row commit-list-working-tree ${sourceRowMenuSurface}`}
                >
                  <a
                    className={`commit-list-item ${styles.link} unread ${
                      workingTreeClean ? "" : styles.dirty
                    } ${selectedIsWorkingTree ? "selected" : ""} ${
                      !workingTreeClean && selectedIsWorkingTree
                        ? styles.dirtySelected
                        : ""
                    }`}
                    href={revisionHref(WORKING_TREE_KEY)}
                    data-source-list-item
                    onFocus={() => {
                      if (isWideScreen) onFocusRevision(WORKING_TREE_KEY);
                    }}
                    {...workingTreeTargetProps}
                    onKeyDown={(event) => {
                      workingTreeTargetProps.onKeyDown(event);
                      handleRevisionEnter(
                        event,
                        WORKING_TREE_KEY,
                        onEnterRevision,
                      );
                    }}
                    onClick={(event) => {
                      if (isModifiedLinkActivation(event)) return;
                      event.preventDefault();
                      workingTreeTargetProps.onClick();
                    }}
                  >
                    <span className="commit-subject-row">
                      <span className="commit-subject">
                        {t("sourceWorkingTree")}
                      </span>
                      {workingTreeCommentCount > 0 && (
                        <span
                          className="source-comment-badge"
                          title={t("sourceCommentCount", {
                            count: workingTreeCommentCount,
                          })}
                        >
                          {workingTreeCommentCount}
                        </span>
                      )}
                    </span>
                    <span className="commit-meta">
                      {workingTreeClean ? (
                        <>
                          <span className={styles.cleanLabel}>
                            {t("gitStatusClean")}
                          </span>
                          <span>{t("sourceWorkingTreeCleanDescription")}</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.dirtyLabel}>
                            {t("sourceUncommitted")}
                          </span>
                          <span>
                            {t("sourceChangedFileCount", {
                              count: workingTreeFileCount,
                            })}
                          </span>
                        </>
                      )}
                    </span>
                  </a>
                  <SourceRowMenuTrigger
                    actions={workingTreeMenuActions}
                    label={t("sourceMoreActions")}
                    onOpen={revisionMenu.openFromButton}
                  />
                </li>
              )}
              {displayedCommits.map((commit, index) => {
                const commentCount = commentCountBySha.get(commit.hash) ?? 0;
                const menuActions = revisionMenuActions(commit.hash, commit);
                const targetProps = revisionMenu.targetProps(menuActions, () =>
                  onOpenRevision(commit.hash),
                );
                const match = commitSearchMatches.get(commit.hash);
                const formattedDate = formatCommitDate(commit.authorDate);
                const relativeDate = formatRemoteCheckTime(
                  commit.authorDate,
                  nowMs,
                  t,
                );
                const matchContext = getCommitMatchContext(match, searchQuery, {
                  shown: relativeDate,
                  full: formattedDate,
                });
                return (
                  <li
                    key={commit.hash}
                    className={`commit-list-row ${sourceRowMenuSurface}`}
                  >
                    <a
                      className={`commit-list-item ${styles.link} ${styles.commit} ${
                        selectedKey === commit.hash ? "selected" : ""
                      } ${isRead(commit.authorDate) ? "read" : "unread"}`}
                      href={revisionHref(commit.hash)}
                      data-source-list-item
                      onFocus={() => {
                        if (isWideScreen) onFocusRevision(commit.hash);
                      }}
                      {...targetProps}
                      onKeyDown={(event) => {
                        targetProps.onKeyDown(event);
                        handleRevisionEnter(
                          event,
                          commit.hash,
                          onEnterRevision,
                        );
                      }}
                      onClick={(event) => {
                        if (isModifiedLinkActivation(event)) return;
                        event.preventDefault();
                        targetProps.onClick();
                      }}
                    >
                      <CommitGraphCell
                        first={index === 0}
                        last={
                          index === displayedCommits.length - 1 &&
                          (!hasMore || searchActive)
                        }
                        head={commit.hash === headSha}
                      />
                      <span className={styles.body}>
                        <span className="commit-subject-row">
                          <SearchMatchText
                            className="commit-subject"
                            text={commit.subject}
                            query={
                              match?.field === "subject"
                                ? searchQuery
                                : undefined
                            }
                            title={commit.subject}
                          />
                          {commit.hash === headSha && <HeadTag />}
                          {commentCount > 0 && (
                            <span
                              className="source-comment-badge"
                              title={t("sourceCommentCount", {
                                count: commentCount,
                              })}
                            >
                              {commentCount}
                            </span>
                          )}
                        </span>
                        <span className={`commit-meta ${styles.meta}`}>
                          <CommitAuthorInitial name={commit.authorName} />
                          <SearchMatchText
                            className="commit-author"
                            text={commit.authorName}
                            query={
                              match?.field === "author"
                                ? searchQuery
                                : undefined
                            }
                          />
                          <SearchMatchText
                            className={`commit-hash ${styles.hash}`}
                            text={commit.shortHash}
                            query={
                              match?.field === "shortHash"
                                ? searchQuery
                                : undefined
                            }
                          />
                          <SearchMatchText
                            className={`commit-date ${styles.date}`}
                            text={relativeDate}
                            title={formattedDate}
                            query={
                              match?.field === "date" &&
                              findTextMatch(relativeDate, searchQuery)
                                ? searchQuery
                                : undefined
                            }
                          />
                        </span>
                        {matchContext && (
                          <SearchMatchText
                            className={styles.matchContext}
                            text={matchContext}
                            query={searchQuery}
                            title={matchContext}
                          />
                        )}
                      </span>
                    </a>
                    <SourceRowMenuTrigger
                      actions={menuActions}
                      label={t("sourceMoreActions")}
                      onOpen={revisionMenu.openFromButton}
                    />
                  </li>
                );
              })}
            </ol>
            {listError && <SourcePaneError message={listError} />}
            {hasMore && !searchActive && (
              <button
                type="button"
                className="commit-load-more"
                onClick={onLoadMore}
              >
                {t("sourceLoadMore")}
              </button>
            )}
          </>
        )}
      </div>
      {revisionMenu.menu}
    </>
  );
}

function handleRevisionEnter(
  event: KeyboardEvent<HTMLAnchorElement>,
  key: string,
  onEnterRevision: (key: string) => void,
): void {
  if (
    event.defaultPrevented ||
    event.key !== "Enter" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return;
  }
  event.preventDefault();
  if (!event.repeat) onEnterRevision(key);
}

function isModifiedLinkActivation(
  event: MouseEvent<HTMLAnchorElement>,
): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * Extra line under a row for matches the row does not show: a change or full
 * hash, or a date the relative label hides (then the full date, else the
 * indexed text).
 */
function getCommitMatchContext(
  match: CommitSearchMatch | undefined,
  query: string,
  date: { shown: string; full: string },
): string | null {
  if (!match) return null;
  if (match.field === "change" || match.field === "hash") return match.text;
  if (match.field === "date" && !findTextMatch(date.shown, query)) {
    return findTextMatch(date.full, query) ? date.full : match.text;
  }
  return null;
}

function formatCommitDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
