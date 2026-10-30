import type {
  ContextUsage,
  ProviderChildSessionSummary,
} from "@vibeallday/shared";
import { memo, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import { Count, IconButton, Sheet, Tabs, type TabItem } from "../garden";
import { DiffIcon, ListIcon, PanelLeftIcon } from "../garden/icons";
import { ChangesPanel } from "./ChangesPanel";
import { ChildrenPanel } from "./ChildrenPanel";
import { ContextPanel } from "./ContextPanel";
import type { InspectorTab } from "./inspectorState";
import type { PlanSnapshot } from "./inspectorPlan";
import { PlanPanel } from "./PlanPanel";
import styles from "./SessionInspector.module.css";

/** Everything the panels read; keep each field stable across stream ticks. */
export interface SessionInspectorData {
  projectId: string;
  sessionId: string;
  basePath: string;
  sourceControlAvailable: boolean;
  contextUsage?: ContextUsage;
  providerChildren?: ProviderChildSessionSummary[];
  running: boolean;
  plan: PlanSnapshot | null;
}

interface SessionInspectorProps {
  data: SessionInspectorData;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
}

const TAB_LABEL = {
  changes: "sessionInspectorTabChanges",
  plan: "sessionInspectorTabPlan",
  context: "sessionInspectorTabContext",
  children: "sessionInspectorTabChildren",
} as const;

function visibleTabs(data: SessionInspectorData): InspectorTab[] {
  const tabs: InspectorTab[] = ["plan", "context", "children"];
  return data.sourceControlAvailable ? ["changes", ...tabs] : tabs;
}

/** Only the open tab mounts, so each panel loads its data when shown. */
function ActivePanel({
  data,
  tab,
}: {
  data: SessionInspectorData;
  tab: InspectorTab;
}) {
  switch (tab) {
    case "changes":
      return (
        <ChangesPanel
          projectId={data.projectId}
          sessionId={data.sessionId}
          basePath={data.basePath}
        />
      );
    case "plan":
      return <PlanPanel plan={data.plan} />;
    case "context":
      return (
        <ContextPanel sessionId={data.sessionId} usage={data.contextUsage} />
      );
    case "children":
      return (
        <ChildrenPanel
          projectId={data.projectId}
          sessionId={data.sessionId}
          basePath={data.basePath}
          childrenFromSession={data.providerChildren}
          running={data.running}
        />
      );
  }
}

/** Tabs plus the active panel; shared by the dock and the sheet. */
function SessionInspectorBody({
  data,
  tab,
  onTabChange,
}: SessionInspectorProps) {
  const { t } = useI18n();
  const tabs = visibleTabs(data);
  const active = tabs.includes(tab) ? tab : (tabs[0] ?? "plan");
  const childCount = data.providerChildren?.length ?? 0;
  const items: TabItem<InspectorTab>[] = tabs.map((value) => ({
    value,
    label: t(TAB_LABEL[value]),
    badge:
      value === "children" && childCount > 0 ? (
        <Count>{childCount}</Count>
      ) : undefined,
  }));
  return (
    <>
      <Tabs
        label={t("sessionInspectorLabel")}
        items={items}
        value={active}
        onChange={onTabChange}
        className={styles.tabs}
      />
      <div className={styles.panel} role="tabpanel">
        <ActivePanel data={data} tab={active} />
      </div>
    </>
  );
}

/** Docked 320px column beside the transcript (wide layouts). */
export const SessionInspectorDock = memo(function SessionInspectorDock({
  className,
  ...props
}: SessionInspectorProps & { className?: string }) {
  const { t } = useI18n();
  return (
    <aside
      className={`${styles.dock} ${className ?? ""}`}
      aria-label={t("sessionInspectorLabel")}
      data-session-inspector="dock"
    >
      <SessionInspectorBody {...props} />
    </aside>
  );
});

/** The same panels as a sheet (phones) or dialog (drawer widths). */
export const SessionInspectorSheet = memo(function SessionInspectorSheet({
  onClose,
  ...props
}: SessionInspectorProps & { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet title={t("sessionInspectorLabel")} onClose={onClose}>
      <div className={styles.sheetBody} data-session-inspector="sheet">
        <SessionInspectorBody {...props} />
      </div>
    </Sheet>
  );
});

/** Header toggle: docks or undocks the inspector, or opens it as a sheet. */
export function SessionInspectorToggle({
  pressed,
  onClick,
  className,
}: {
  pressed?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <IconButton
      label={t(pressed ? "sessionInspectorHide" : "sessionInspectorShow")}
      aria-pressed={pressed}
      onClick={onClick}
      className={`${styles.toggle} ${className ?? ""}`}
    >
      <PanelLeftIcon />
    </IconButton>
  );
}

interface ChipsProps {
  sourceControlAvailable: boolean;
  contextPercent?: number;
  childCount: number;
  onOpen: (tab: InspectorTab) => void;
}

function Chip({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.chip} onClick={onClick}>
      {children}
    </button>
  );
}

/** Phone row under the header; each chip opens its panel as a sheet. */
export const SessionInspectorChips = memo(function SessionInspectorChips({
  sourceControlAvailable,
  contextPercent,
  childCount,
  onOpen,
}: ChipsProps) {
  const { t } = useI18n();
  return (
    <nav className={styles.chips} aria-label={t("sessionInspectorPanels")}>
      {sourceControlAvailable && (
        <Chip onClick={() => onOpen("changes")}>
          <DiffIcon aria-hidden="true" />
          {t("sessionInspectorTabChanges")}
        </Chip>
      )}
      <Chip onClick={() => onOpen("plan")}>
        <ListIcon aria-hidden="true" />
        {t("sessionInspectorTabPlan")}
      </Chip>
      <Chip onClick={() => onOpen("context")}>
        {contextPercent === undefined
          ? t("sessionInspectorTabContext")
          : t("sessionInspectorContextChip", { percent: contextPercent })}
      </Chip>
      {childCount > 0 && (
        <Chip onClick={() => onOpen("children")}>
          {t("sessionInspectorTabChildren")}
          <Count>{childCount}</Count>
        </Chip>
      )}
    </nav>
  );
});
