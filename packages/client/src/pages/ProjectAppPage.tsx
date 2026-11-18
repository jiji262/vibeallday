import { SERVER_CAPABILITIES, serverHasCapability } from "@vibeallday/shared";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ProjectAppTarget } from "../api/projectApp";
import { NewSessionForm } from "../components/NewSessionForm";
import { PageHeader } from "../components/PageHeader";
import { ProjectAppViewer } from "../components/ProjectAppViewer";
import viewerStyles from "../components/ProjectAppViewer.module.css";
import type { VoiceInputButtonRef } from "../components/VoiceInputButton";
import { useProject } from "../hooks/useProjects";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import styles from "./ProjectAppPage.module.css";

export function ProjectAppPage() {
  const { t } = useI18n();
  const { projectId } = useParams<{ projectId: string }>();
  const { version } = useVersion();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const enabled = serverHasCapability(
    version,
    SERVER_CAPABILITIES.projectService.name,
  );
  if (!projectId || !enabled) {
    return (
      <MainContent isWideScreen={isWideScreen}>
        <PageHeader
          title={t("projectAppLabel")}
          onOpenSidebar={openSidebar}
          isWideScreen={isWideScreen}
        />
        <div className={styles.unsupportedFrame}>
          <p className={styles.unsupportedMessage}>
            {t("projectAppUpdateRequired")}
          </p>
        </div>
      </MainContent>
    );
  }
  return <ProjectAppWorkspace key={projectId} projectId={projectId} />;
}

function ProjectAppWorkspace({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { isWideScreen } = useNavigationLayout();
  const { project } = useProject(projectId);
  const basePath = useRemoteBasePath();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [composing, setComposing] = useState(params.get("compose") === "1");
  const [showApp, setShowApp] = useState(
    isWideScreen || params.get("compose") !== "1",
  );
  const [voice, setVoice] = useState<VoiceInputButtonRef | null>(null);
  const [target, setTarget] = useState<ProjectAppTarget>();
  const begin = () => {
    setComposing(true);
    setShowApp(isWideScreen);
  };
  const composerHidden = !composing || (!isWideScreen && showApp);
  return (
    <MainContent
      isWideScreen={isWideScreen}
      innerClassName={`${viewerStyles.workspace} ${styles.workspace}`}
    >
      {project && (
        <div
          className={`${viewerStyles.composer} ${styles.composerPane}${
            composerHidden
              ? ` ${viewerStyles.concealed} ${styles.concealed}`
              : ""
          }`}
        >
          <div className={styles.composerTopBar}>
            <button
              type="button"
              className={styles.appSwitchButton}
              onClick={() => {
                setShowApp(true);
              }}
            >
              {t("projectAppLabel")}
            </button>
          </div>
          <div className={styles.composerScroll}>
            <NewSessionForm
              projectId={projectId}
              selectedProject={project}
              projects={[project]}
              autoFocus={false}
              fixedProject={showApp}
              projectApp={target}
              onVoiceControl={setVoice}
            />
          </div>
        </div>
      )}
      <div
        className={`${viewerStyles.appColumn} ${styles.appViewport}${
          !showApp ? ` ${viewerStyles.concealed} ${styles.concealed}` : ""
        }`}
      >
        <ProjectAppViewer
          projectId={projectId}
          projectName={project?.name}
          onTarget={setTarget}
          voice={voice}
          onSession={begin}
          onVoice={begin}
          initialSettings={params.get("settings") === "1"}
          onBack={() => {
            if (composing) {
              setShowApp(false);
              setComposing(true);
            } else {
              navigate(`${basePath}/projects`);
            }
          }}
        />
      </div>
    </MainContent>
  );
}
