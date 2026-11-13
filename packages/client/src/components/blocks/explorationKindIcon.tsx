import type { ExplorationEntry } from "../../lib/sessionDetail/explorationProjection";
import { FileIcon, FolderIcon, SearchIcon } from "../garden/icons";

/** Work-log rows read at a glance: the icon column names the kind of step. */
const ICON_SIZE = 14;

export function ExplorationKindIcon({
  kind,
}: {
  kind: ExplorationEntry["kind"];
}) {
  switch (kind) {
    case "read":
      return <FileIcon size={ICON_SIZE} />;
    case "search":
      return <SearchIcon size={ICON_SIZE} />;
    case "list":
      return <FolderIcon size={ICON_SIZE} />;
  }
}
