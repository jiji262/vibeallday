import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { ArtifactLinkViewer } from "../components/ArtifactLinkViewer";
import { ErrorState } from "../components/garden/ErrorState";
import { LoadingState } from "../components/garden/LoadingState";
import { LocalFileModal } from "../components/LocalMediaModal";
import { useVersion } from "../hooks/useVersion";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { isArtifactLink } from "../lib/artifactPreview";
import { useI18n } from "../i18n";
import styles from "./ViewerModePage.module.css";

/** Authenticated, source-host-preserving destination for viewer mode links. */
export function ViewerModePage() {
  const [query] = useSearchParams();
  const [artifactHost, setArtifactHost] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const base = useRemoteBasePath();
  const { version } = useVersion();
  const { t } = useI18n();
  const close = () => navigate(`${base}/sessions`);
  const path = query.get("path");
  const projectId = query.get("projectId");
  const artifactUrl = query.get("artifactUrl");
  const mode = query.get("mode");
  const position = (key: string) => {
    const number = Number(query.get(key));
    return Number.isSafeInteger(number) && number > 0 ? number : undefined;
  };
  if (mode !== "edit" && mode !== "interactive") {
    return (
      <div className={`${styles.viewport} ${styles.stateViewport}`}>
        <div className={styles.stateCard}>
          <ErrorState message={t("fileInvalidUrl")} />
        </div>
      </div>
    );
  }
  if (artifactUrl) {
    if (!version) {
      return (
        <div className={`${styles.viewport} ${styles.stateViewport}`}>
          <div className={styles.stateCard}>
            <LoadingState label={t("sourceEditorLoading")} variant="page" />
          </div>
        </div>
      );
    }
    if (
      !isArtifactLink(artifactUrl, version.artifactViewer, window.location.href)
    ) {
      return (
        <div className={`${styles.viewport} ${styles.stateViewport}`}>
          <div className={styles.stateCard}>
            <ErrorState message={t("artifactUnavailable")} />
          </div>
        </div>
      );
    }
    return (
      <div className={styles.viewport}>
        <div className={styles.artifactHost} ref={setArtifactHost}>
          {artifactHost && (
            <ArtifactLinkViewer
              standalone
              portalTarget={artifactHost}
              inactive={false}
              initiallyEditing={mode === "edit"}
              controller={{
                kind: "artifact",
                id: artifactUrl,
                sessionId: "standalone",
                label:
                  new URL(artifactUrl).pathname.split("/").at(-1) ??
                  artifactUrl,
                url: artifactUrl,
                close,
                minimize: close,
                restore: () => {},
                minimized: false,
              }}
            />
          )}
        </div>
      </div>
    );
  }
  if (!path) {
    return (
      <div className={`${styles.viewport} ${styles.stateViewport}`}>
        <div className={styles.stateCard}>
          <ErrorState message={t("fileMissingPath")} />
        </div>
      </div>
    );
  }
  return (
    <div className={styles.viewport}>
      <div className={styles.modalHost}>
        <LocalFileModal
          resource={
            projectId
              ? {
                  kind: "project-file",
                  projectId,
                  path,
                  lineNumber: position("line"),
                  columnNumber: position("column"),
                }
              : {
                  kind: "local-file",
                  path,
                  lineNumber: position("line"),
                  columnNumber: position("column"),
                }
          }
          initialMode={mode}
          onClose={close}
        />
      </div>
    </div>
  );
}
