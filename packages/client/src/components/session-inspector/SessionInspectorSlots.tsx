import {
  SessionInspectorChips,
  SessionInspectorDock,
  SessionInspectorSheet,
} from "./SessionInspector";
import type { SessionInspectorController } from "./useSessionInspector";

/**
 * What the session page mounts right under its header: the phone chip row
 * and, when one is open, the inspector sheet.
 */
export function SessionInspectorHeaderSlots({
  inspector,
  chips,
}: {
  inspector: SessionInspectorController;
  /** Phone layout: a chip row stands in for the docked column. */
  chips: boolean;
}) {
  const { data } = inspector;
  const percent = data.contextUsage
    ? Math.round(data.contextUsage.percentage)
    : undefined;
  return (
    <>
      {chips && (
        <SessionInspectorChips
          sourceControlAvailable={data.sourceControlAvailable}
          contextPercent={percent}
          childCount={data.providerChildren?.length ?? 0}
          onOpen={inspector.openSheet}
        />
      )}
      {inspector.sheetTab && (
        <SessionInspectorSheet
          data={data}
          tab={inspector.sheetTab}
          onTabChange={inspector.openSheet}
          onClose={inspector.closeSheet}
        />
      )}
    </>
  );
}

/**
 * The docked 320px column. The session split places it in its own grid
 * area beside the transcript and composer, under the header.
 */
export function SessionInspectorDockSlot({
  inspector,
  className,
}: {
  inspector: SessionInspectorController;
  className?: string;
}) {
  if (!inspector.dockVisible) return null;
  return (
    <SessionInspectorDock
      data={inspector.data}
      tab={inspector.tab}
      onTabChange={inspector.setTab}
      className={className}
    />
  );
}
