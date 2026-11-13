import { useState } from "react";
import type { useProjectTemplateChoices } from "../hooks/useProjectTemplateChoices";
import { type MessageKey, useI18n } from "../i18n";
import type { Project } from "../types";
import { AddProjectForm, type AddProjectRequest } from "./AddProjectForm";
import formStyles from "./AddProjectForm.module.css";
import { Button } from "./garden/Button";
import { Count } from "./garden/Count";
import { Sheet } from "./garden/Sheet";
import { type TabItem, Tabs } from "./garden/Tabs";
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

type AddProjectMode = "folder" | "template";
type Translate = ReturnType<typeof useI18n>["t"];

function modeTabs(
  t: Translate,
  templateCount: number,
  busy: boolean,
): TabItem<AddProjectMode>[] {
  return [
    { value: "folder", label: t("addProjectTabFolder"), disabled: busy },
    {
      value: "template",
      label: t("addProjectTabTemplate"),
      badge: <Count>{templateCount}</Count>,
      disabled: busy,
    },
  ];
}

type TemplatePanelProps = Pick<
  AddProjectSheetProps,
  | "templateChoices"
  | "templateError"
  | "emptyMessageKey"
  | "projects"
  | "pathBase"
  | "onTemplateStarted"
> & { hidden: boolean; onBusyChange: (busy: boolean) => void };

/** The template chooser, mounted while hidden so its draft survives tabs. */
function TemplatePanel({
  templateChoices,
  templateError,
  emptyMessageKey,
  projects,
  pathBase,
  onTemplateStarted,
  hidden,
  onBusyChange,
}: TemplatePanelProps) {
  const { t } = useI18n();
  if (!templateChoices?.enabled) return null;
  return (
    <div hidden={hidden}>
      <TemplateProjectForm
        templates={templateChoices.templates}
        emptyMessage={templateError ?? t(emptyMessageKey)}
        projects={projects}
        pathBase={pathBase}
        onBusyChange={onBusyChange}
        onStarted={onTemplateStarted}
      />
    </div>
  );
}

/**
 * Add project: a dialog on desktop and a bottom sheet on phones, with the
 * 本机文件夹 | 从模板创建 tabs when templates are enabled. Both panels stay
 * mounted, so switching tabs keeps what was typed. Limited users can only
 * create from a template, so they get the template panel alone.
 */
export function AddProjectSheet(props: AddProjectSheetProps) {
  const { projects, pathBase, adding, templateChoices, templateError } = props;
  const { limitedTemplateOnly, onClose } = props;
  const { t } = useI18n();
  const [mode, setMode] = useState<AddProjectMode>("folder");
  const [templateBusy, setTemplateBusy] = useState(false);
  // Like the disabled Cancel, the close button, Escape and scrim wait for an
  // in-flight request instead of unmounting the form under it.
  const busy = adding || templateBusy;
  const close = busy ? () => {} : onClose;
  const showTabs = !!templateChoices?.enabled && !limitedTemplateOnly;
  const shownMode: AddProjectMode = limitedTemplateOnly ? "template" : mode;
  return (
    <Sheet title={t("projectsAdd")} onClose={close}>
      <div className={formStyles.sheetBody}>
        {showTabs && (
          <Tabs
            label={t("addProjectTabsLabel")}
            items={modeTabs(t, templateChoices?.templates.length ?? 0, busy)}
            value={shownMode}
            onChange={setMode}
          />
        )}
        {!limitedTemplateOnly && (
          <div hidden={shownMode !== "folder"}>
            <AddProjectForm
              projects={projects}
              pathBase={pathBase}
              chooseName={props.chooseName}
              chooseCodeName={props.chooseCodeName}
              adding={busy}
              error={props.error}
              onSubmit={props.onSubmit}
              onCancel={onClose}
            />
          </div>
        )}
        {templateError && (shownMode === "template" || !showTabs) && (
          <p role="alert">{templateError}</p>
        )}
        <TemplatePanel
          {...props}
          hidden={shownMode !== "template"}
          onBusyChange={setTemplateBusy}
        />
        {limitedTemplateOnly && (
          <Button variant="ghost" disabled={templateBusy} onClick={onClose}>
            {t("projectsCancel")}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
