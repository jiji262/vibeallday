import type { ProjectWorkstreamsResponse } from "@vibeallday/shared";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button } from "../components/garden/Button";
import { EmptyState } from "../components/garden/EmptyState";
import { ErrorState } from "../components/garden/ErrorState";
import { PlusIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useServerSettings } from "../hooks/useServerSettings";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { activityBus } from "../lib/activityBus";
import {
  WorkstreamCreateForm,
  type WorkstreamsPreviewState,
} from "./WorkstreamCreateForm";
import styles from "./WorkstreamsPage.module.css";
import { WorkstreamsTable } from "./WorkstreamsTable";

/** Lane table columns, for the table-shaped loading skeleton. */
const WORKSTREAM_COLUMNS = 7;

type WorkstreamsLoadState =
  | { status: "idle" | "loading" }
  | { status: "loaded"; data: ProjectWorkstreamsResponse }
  | { status: "error"; error: Error; statusCode?: number };

function errorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return undefined;
}

function errorMessage(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

function WorkstreamsStateMessage({
  title,
  message,
  variant = "neutral",
}: {
  title: string;
  message?: string;
  variant?: "neutral" | "error";
}) {
  const { t } = useI18n();
  if (variant === "error") {
    return (
      <ErrorState
        tag={t("errorTag")}
        title={title}
        message={message ?? title}
      />
    );
  }
  return <EmptyState title={title} hint={message} />;
}

export function WorkstreamsPage() {
  const { t } = useI18n();
  const { projectId } = useParams<{ projectId: string }>();
  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useServerSettings();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const [loadState, setLoadState] = useState<WorkstreamsLoadState>({
    status: "idle",
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkstreamLabel, setNewWorkstreamLabel] = useState("");
  const [previewState, setPreviewState] = useState<WorkstreamsPreviewState>({
    status: "idle",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);
  const enabled = settings?.workstreamsEnabled === true;

  const loadWorkstreams = useCallback(
    async (options: { background?: boolean } = {}) => {
      if (!enabled || !projectId) {
        setLoadState({ status: "idle" });
        return;
      }

      const requestId = ++loadSequenceRef.current;
      setLoadState((current) =>
        options.background && current.status === "loaded"
          ? current
          : { status: "loading" },
      );

      try {
        const data = await api.getProjectWorkstreams(projectId);
        if (requestId !== loadSequenceRef.current) return;
        setLoadState({ status: "loaded", data });
      } catch (err) {
        if (requestId !== loadSequenceRef.current) return;
        setLoadState({
          status: "error",
          error: errorMessage(err, t("workstreamsLoadFailed")),
          statusCode: errorStatus(err),
        });
      }
    },
    [enabled, projectId, t],
  );

  useEffect(() => {
    void loadWorkstreams();
  }, [loadWorkstreams]);

  useEffect(() => {
    if (!enabled || !projectId) {
      return undefined;
    }

    return activityBus.on("workstreams-changed", (event) => {
      if (event.projectId === projectId) {
        void loadWorkstreams({ background: true });
      }
    });
  }, [enabled, loadWorkstreams, projectId]);

  useEffect(() => {
    const label = newWorkstreamLabel.trim();
    if (!showCreateForm || !enabled || !projectId || !label) {
      setPreviewState({ status: "idle" });
      return undefined;
    }

    let cancelled = false;
    setPreviewState({ status: "loading" });

    void api
      .getProjectWorkstreamCheckoutPreview(projectId, label)
      .then((data) => {
        if (cancelled) return;
        setPreviewState({ status: "loaded", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewState({
          status: "error",
          error: errorMessage(err, t("workstreamsPreviewFailed")),
          statusCode: errorStatus(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, newWorkstreamLabel, projectId, showCreateForm, t]);

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId || !enabled || creating) {
      return;
    }

    const label = newWorkstreamLabel.trim();
    if (!label) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await api.createProjectWorkstream(projectId, { label });
      setLoadState({
        status: "loaded",
        data: {
          projectId: response.projectId,
          workstreams: response.workstreams,
        },
      });
      setShowCreateForm(false);
      setNewWorkstreamLabel("");
      setPreviewState({ status: "idle" });
    } catch (err) {
      const statusCode = errorStatus(err);
      if (statusCode === 409) {
        setCreateError(t("workstreamsCreateBusy"));
      } else {
        setCreateError(
          err instanceof Error ? err.message : t("workstreamsCreateFailed"),
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const canShowCreate = enabled && Boolean(projectId);
  const canSubmitCreate =
    canShowCreate &&
    !creating &&
    newWorkstreamLabel.trim().length > 0 &&
    previewState.status === "loaded";

  const content = useMemo(() => {
    if (!projectId) {
      return (
        <WorkstreamsStateMessage
          title={t("workstreamsNoAccessTitle")}
          message={t("workstreamsNoAccessDescription")}
          variant="error"
        />
      );
    }

    if (settingsLoading && !settings) {
      return (
        <LoadingState
          label={t("workstreamsLoading")}
          variant="table"
          columns={WORKSTREAM_COLUMNS}
        />
      );
    }

    if (settingsError && !settings) {
      return (
        <WorkstreamsStateMessage
          title={t("workstreamsSettingsErrorTitle")}
          message={settingsError}
          variant="error"
        />
      );
    }

    if (!enabled) {
      return (
        <WorkstreamsStateMessage
          title={t("workstreamsDisabledTitle")}
          message={t("workstreamsDisabledDescription")}
        />
      );
    }

    if (loadState.status === "idle" || loadState.status === "loading") {
      return (
        <LoadingState
          label={t("workstreamsLoading")}
          variant="table"
          columns={WORKSTREAM_COLUMNS}
        />
      );
    }

    if (loadState.status === "error") {
      if (loadState.statusCode === 403 || loadState.statusCode === 404) {
        return (
          <WorkstreamsStateMessage
            title={t("workstreamsNoAccessTitle")}
            message={t("workstreamsNoAccessDescription")}
            variant="error"
          />
        );
      }

      return (
        <WorkstreamsStateMessage
          title={t("workstreamsErrorTitle")}
          message={loadState.error.message}
          variant="error"
        />
      );
    }

    if (loadState.status === "loaded") {
      return (
        <WorkstreamsTable workstreams={loadState.data.workstreams} t={t} />
      );
    }

    return (
      <LoadingState
        label={t("workstreamsLoading")}
        variant="table"
        columns={WORKSTREAM_COLUMNS}
      />
    );
  }, [
    enabled,
    loadState,
    projectId,
    settings,
    settingsError,
    settingsLoading,
    t,
  ]);

  const openCreateForm = () => {
    setShowCreateForm(true);
    setCreateError(null);
  };

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("workstreamsTitle")}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />

      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          <PageIntro
            title={t("workstreamsTitle")}
            lede={t("workstreamsDescription")}
            actions={
              canShowCreate ? (
                <Button
                  variant="primary"
                  icon={<PlusIcon />}
                  onClick={openCreateForm}
                  disabled={showCreateForm || creating}
                >
                  {t("workstreamsNewAction")}
                </Button>
              ) : undefined
            }
          />
          <div className={styles.page}>
            {canShowCreate && showCreateForm ? (
              <WorkstreamCreateForm
                label={newWorkstreamLabel}
                previewState={previewState}
                creating={creating}
                createError={createError}
                canSubmit={canSubmitCreate}
                onLabelChange={(value) => {
                  setNewWorkstreamLabel(value);
                  setCreateError(null);
                }}
                onCancel={() => {
                  if (creating) return;
                  setShowCreateForm(false);
                  setNewWorkstreamLabel("");
                  setCreateError(null);
                  setPreviewState({ status: "idle" });
                }}
                onSubmit={handleCreateSubmit}
                t={t}
              />
            ) : null}

            {content}
          </div>
        </div>
      </main>
    </MainContent>
  );
}
