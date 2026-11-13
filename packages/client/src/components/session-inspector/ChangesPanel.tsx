import type { GitFileChange, GitStatusInfo } from "@vibeallday/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useI18n } from "../../i18n";
import { Button, EmptyState, Tag } from "../garden";
import { DiffIcon, GitBranchIcon, RefreshIcon } from "../garden/icons";
import { sessionChangesHref } from "../SessionChangesButton";
import styles from "./SessionInspector.module.css";

const META_ICON_SIZE = 14;

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; info: GitStatusInfo }
  | { status: "error"; message: string };

interface ChangesPanelProps {
  projectId: string;
  sessionId: string;
  basePath: string;
}

/**
 * One git-status read each time the tab mounts (or Refresh is pressed); the
 * panel never polls. Files this session edited sort first.
 */
function useGitStatusOnce(projectId: string) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Each read takes a ticket; a stale or unmounted read never writes.
  const ticket = useRef(0);
  const load = useCallback(() => {
    ticket.current += 1;
    const mine = ticket.current;
    setState({ status: "loading" });
    api.getGitStatus(projectId, { useUntrackedCache: true }).then(
      (info) => {
        if (ticket.current === mine) setState({ status: "loaded", info });
      },
      (error: unknown) => {
        if (ticket.current !== mine) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
  }, [projectId]);
  useEffect(() => {
    load();
    return () => {
      ticket.current += 1;
    };
  }, [load]);
  return { state, refresh: load };
}

function splitPath(path: string): { name: string; dir: string } {
  const trimmed = path.replace(/\/$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash < 0
    ? { name: trimmed, dir: "" }
    : { name: trimmed.slice(slash + 1), dir: trimmed.slice(0, slash) };
}

function isNewFile(file: GitFileChange): boolean {
  return file.status === "?" || file.status === "A";
}

function FileRow({ file, mine }: { file: GitFileChange; mine: boolean }) {
  const { t } = useI18n();
  const { name, dir } = splitPath(file.path);
  return (
    <li className={styles.fileRow}>
      <span className={styles.fileText}>
        <span className={styles.fileName} title={file.path}>
          {name}
        </span>
        <span className={styles.meta}>
          {dir}
          {isNewFile(file) && ` · ${t("sessionInspectorChangesNewFile")}`}
        </span>
      </span>
      {mine && (
        <Tag tone="accent">{t("sessionInspectorChangesThisSession")}</Tag>
      )}
      <span className={styles.meta}>
        {file.linesAdded !== null && (
          <span className={styles.adds}>+{file.linesAdded}</span>
        )}{" "}
        {file.linesDeleted !== null && file.linesDeleted > 0 && (
          <span className={styles.dels}>−{file.linesDeleted}</span>
        )}
      </span>
    </li>
  );
}

function BranchLine({ info }: { info: GitStatusInfo }) {
  const { t } = useI18n();
  const parts = [info.branch ?? t("sessionInspectorChangesDetached")];
  if (info.ahead > 0) {
    parts.push(t("sessionInspectorChangesAhead", { count: info.ahead }));
  }
  if (info.behind > 0) {
    parts.push(t("sessionInspectorChangesBehind", { count: info.behind }));
  }
  return (
    <div className={styles.kv}>
      <GitBranchIcon size={META_ICON_SIZE} aria-hidden="true" />
      <span className={styles.kvKey}>{t("sessionInspectorChangesBranch")}</span>
      <span className={styles.meta}>{parts.join(" · ")}</span>
    </div>
  );
}

function sortForSession(
  files: readonly GitFileChange[],
  sessionId: string,
): GitFileChange[] {
  const mine = (file: GitFileChange) =>
    file.lastEditor?.sessionId === sessionId;
  return [...files].sort((a, b) => Number(mine(b)) - Number(mine(a)));
}

function ChangesSummary({ files }: { files: readonly GitFileChange[] }) {
  const { t } = useI18n();
  let added = 0;
  let deleted = 0;
  for (const file of files) {
    added += file.linesAdded ?? 0;
    deleted += file.linesDeleted ?? 0;
  }
  return (
    <div className={styles.summary}>
      <span className={styles.strong}>
        {t("sessionInspectorChangesFiles", { count: files.length })}
      </span>
      <span className={styles.adds}>+{added}</span>
      <span className={styles.dels}>−{deleted}</span>
      <Tag className={styles.push}>
        {t("sessionInspectorChangesUncommitted")}
      </Tag>
    </div>
  );
}

function LoadedChanges({
  info,
  sessionId,
}: {
  info: GitStatusInfo;
  sessionId: string;
}) {
  const { t } = useI18n();
  if (!info.isGitRepo) {
    return <p className={styles.hint}>{t("sessionInspectorChangesNotRepo")}</p>;
  }
  const files = sortForSession(info.files, sessionId);
  return (
    <>
      {files.length === 0 ? (
        <EmptyState compact title={t("sessionInspectorChangesEmpty")} />
      ) : (
        <>
          <ChangesSummary files={files} />
          <ul className={styles.list}>
            {files.map((file) => (
              <FileRow
                key={`${file.staged ? "s" : "w"}:${file.path}`}
                file={file}
                mine={file.lastEditor?.sessionId === sessionId}
              />
            ))}
          </ul>
        </>
      )}
      <BranchLine info={info} />
    </>
  );
}

export function ChangesPanel({
  projectId,
  sessionId,
  basePath,
}: ChangesPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state, refresh } = useGitStatusOnce(projectId);
  return (
    <div className={styles.panelBody}>
      {state.status === "loading" && (
        <p className={styles.hint}>{t("sessionInspectorLoading")}</p>
      )}
      {state.status === "error" && (
        <p className={styles.hint} role="alert">
          {t("sessionInspectorLoadFailed", { message: state.message })}
        </p>
      )}
      {state.status === "loaded" && (
        <LoadedChanges info={state.info} sessionId={sessionId} />
      )}
      <div className={styles.actions}>
        <Button
          size="sm"
          icon={<DiffIcon />}
          onClick={() => navigate(sessionChangesHref(basePath, projectId))}
        >
          {t("sessionInspectorChangesOpen")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<RefreshIcon />}
          onClick={refresh}
          disabled={state.status === "loading"}
        >
          {t("sessionInspectorRefresh")}
        </Button>
      </div>
    </div>
  );
}
