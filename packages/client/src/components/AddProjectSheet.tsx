import { useState } from "react";
import type { useProjectTemplateChoices } from "../hooks/useProjectTemplateChoices";
import { type MessageKey, useI18n } from "../i18n";
import type { Project } from "../types";
import { AddProjectForm, type AddProjectRequest } from "./AddProjectForm";
import formStyles from "./AddProjectForm.module.css";
import { Button } from "./garden/Button";
import { Sheet } from "./garden/Sheet";
import { TemplateProjectForm } from "./TemplateProjectForm";

interface AddProjectSheetProps {
  /** Existing projects, for default names and codes. */
  projects: readonly Project[];
  pathBase: string;
  chooseName: boolean;
  chooseCodeName: boolean;
  /** A request is in flight. */
  adding: boolean;
  error: string | null;
  /** Template creation is offered when it is enabled for this user. */
  templateChoices: ReturnType<typeof useProjectTemplateChoices>["choices"];
  templateError: string | null;
  emptyMessageKey: MessageKey;
  /** Limited users can only create from a template, not by path. */
  limitedTemplateOnly: boolean;
  onSubmit: (request: AddProjectRequest) => void;
  onClose: () => void;
  onTemplateStarted: (projectId: string, sessionId: string) => void;
}

/**
 * Add project, as a sheet: the superuser enters a path or name first; the
 * template chooser below it leaves once anything is typed there. Limited
 * users can only create from a template.
 */
export function AddProjectSheet({
  projects,
  pathBase,
  chooseName,
  chooseCodeName,
  adding,
  error,
  templateChoices,
  templateError,
  emptyMessageKey,
  limitedTemplateOnly,
  onSubmit,
  onClose,
  onTemplateStarted,
}: AddProjectSheetProps) {
  const { t } = useI18n();
  const [typed, setTyped] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  // Like the disabled Cancel, the close button, Escape and scrim wait for an
  // in-flight request instead of unmounting the form under it.
  const busy = adding || templateBusy;
  const close = busy ? () => {} : onClose;
  return (
    <Sheet title={t("projectsAdd")} onClose={close}>
      <div className={formStyles.sheetBody}>
        {!limitedTemplateOnly && (
          <AddProjectForm
            projects={projects}
            pathBase={pathBase}
            chooseName={chooseName}
            chooseCodeName={chooseCodeName}
            adding={adding || templateBusy}
            error={error}
            onSubmit={onSubmit}
            onCancel={onClose}
            onTypedChange={setTyped}
          />
        )}
        {templateError && !typed && <p role="alert">{templateError}</p>}
        {templateChoices?.enabled && (
          <div hidden={typed && !templateBusy}>
            {!limitedTemplateOnly && (
              <p className={formStyles.label}>{t("templateOrStart")}</p>
            )}
            <TemplateProjectForm
              templates={templateChoices.templates}
              emptyMessage={templateError ?? t(emptyMessageKey)}
              projects={projects}
              pathBase={pathBase}
              onBusyChange={setTemplateBusy}
              onStarted={onTemplateStarted}
            />
          </div>
        )}
        {limitedTemplateOnly && (
          <Button variant="ghost" disabled={templateBusy} onClick={onClose}>
            {t("projectsCancel")}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
