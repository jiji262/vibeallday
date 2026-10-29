import { useDeferredValue, useMemo } from "react";
import { useI18n } from "../../i18n";
import { SearchIcon } from "../garden/icons";
import {
  buildPaletteSections,
  type PaletteSection,
  sessionsSearchPath,
} from "./paletteData";
import { usePaletteCandidates } from "./usePaletteCandidates";

function useSearchSection(query: string): PaletteSection {
  const { t } = useI18n();
  const trimmed = query.trim();
  return useMemo(
    () => ({
      group: "search",
      items: [
        {
          id: "search:sessions",
          group: "search",
          label: trimmed
            ? t("paletteSearchSessions", { query: trimmed })
            : t("paletteSearchSessionsEmpty"),
          to: sessionsSearchPath(trimmed),
          Icon: SearchIcon,
        },
      ],
    }),
    [t, trimmed],
  );
}

/** The live search row followed by the matched, capped groups. */
export function usePaletteSections(query: string) {
  const candidates = usePaletteCandidates();
  // Results render from a deferred query so each keystroke lands in the
  // field before the list catches up.
  const deferredQuery = useDeferredValue(query);
  const matched = useMemo(
    () => buildPaletteSections(candidates, deferredQuery),
    [candidates, deferredQuery],
  );
  const search = useSearchSection(query);
  return useMemo(() => [search, ...matched], [search, matched]);
}
