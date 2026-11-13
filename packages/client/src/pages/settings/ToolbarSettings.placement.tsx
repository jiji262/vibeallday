import type {
  ToolbarControlPresence,
  ToolbarNarrowingPriority,
} from "@vibeallday/shared";
import { isComposerTrayControl } from "../../hooks/useMessageInputToolbarLayout";
import type { SessionToolbarVisibilityKey } from "../../hooks/useSessionToolbarPresence";
import { type MessageKey, useI18n } from "../../i18n";
import styles from "./ToolbarSettings.module.css";

// Enabled presence-slider notches run from hidden through increasingly durable
// narrowing priorities. Controls that can be disabled add an Off notch first.
export const PRESENCE_SLIDER_PRIORITIES: readonly ToolbarNarrowingPriority[] = [
  "first",
  "mid",
  "last",
  "pin",
];

/** Tiers that put a tray-capable tool in the session "+" tray. */
const TRAY_TIERS: ReadonlySet<ToolbarControlPresence> = new Set([
  "first",
  "mid",
  "last",
]);

/**
 * Captions per tier. Tray tools sit in the "+" tray in a session unless
 * pinned; row tools (attach, mode, thinking, context, status) stay in the
 * session row and fold by measured priority. New Session keeps the measured
 * More (...) narrowing order for both.
 */
const TIER_CAPTION_KEYS: Record<
  "tray" | "row",
  Record<ToolbarNarrowingPriority, MessageKey>
> = {
  tray: {
    first: "settingsToolbarCaptionTrayFirst",
    mid: "settingsToolbarCaptionTrayMid",
    last: "settingsToolbarCaptionTrayLast",
    pin: "settingsToolbarCaptionTrayPin",
  },
  row: {
    first: "settingsToolbarCaptionRowFirst",
    mid: "settingsToolbarCaptionRowMid",
    last: "settingsToolbarCaptionRowLast",
    pin: "settingsToolbarCaptionRowPin",
  },
};

export interface PresenceCaptionInput {
  key: SessionToolbarVisibilityKey;
  canSetPriority: boolean;
  canDisable: boolean;
  notch: number;
}

/** Caption for one slider notch: where that notch puts the control. */
export function presenceCaptionKey({
  key,
  canSetPriority,
  canDisable,
  notch,
}: PresenceCaptionInput): MessageKey {
  if (canDisable && notch <= 0) return "appearanceToolbarPresenceOffCaption";
  const enabledNotch = notch - (canDisable ? 1 : 0);
  if (enabledNotch <= 0) return "appearanceToolbarPresenceHiddenCaption";
  if (!canSetPriority) return "appearanceToolbarPresenceShownCaption";
  const tier = PRESENCE_SLIDER_PRIORITIES[enabledNotch - 1] ?? "pin";
  const placement = isComposerTrayControl(key) ? "tray" : "row";
  return TIER_CAPTION_KEYS[placement][tier];
}

/** True when a shown control sits in the session "+" tray, not the row. */
function sitsInSessionTray(
  key: SessionToolbarVisibilityKey,
  presence: ToolbarControlPresence,
): boolean {
  return isComposerTrayControl(key) && TRAY_TIERS.has(presence);
}

interface PlacementControl {
  key: SessionToolbarVisibilityKey;
  title: string;
  hasToolbarPreview: boolean;
}

function PlacementList({ label, names }: { label: string; names: string[] }) {
  const { t } = useI18n();
  return (
    <div className={styles.placementGroup}>
      <span className={styles.placementLabel}>{label}</span>
      <ul className={styles.placementChips}>
        {names.length === 0 ? (
          <li className={styles.placementEmpty}>
            {t("settingsToolbarPlacementEmpty")}
          </li>
        ) : (
          names.map((name) => (
            <li key={name} className={styles.placementChip}>
              {name}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/**
 * Live summary of where each shown control lands in a session composer: the
 * row, or the "+" tray. Derived from the same tray rule the composer uses.
 */
export function SessionPlacementSummary({
  controls,
  presence,
}: {
  controls: readonly PlacementControl[];
  presence: Record<SessionToolbarVisibilityKey, ToolbarControlPresence>;
}) {
  const { t } = useI18n();
  const shown = controls.filter((control) => {
    const value = presence[control.key];
    return control.hasToolbarPreview && value !== "hidden" && value !== "off";
  });
  const row = shown.filter(
    (control) => !sitsInSessionTray(control.key, presence[control.key]),
  );
  const tray = shown.filter((control) =>
    sitsInSessionTray(control.key, presence[control.key]),
  );
  return (
    <section
      className={styles.placement}
      aria-label={t("settingsToolbarPlacementHeading")}
    >
      <strong className={styles.placementHeading}>
        {t("settingsToolbarPlacementHeading")}
      </strong>
      <PlacementList
        label={t("settingsToolbarPlacementRow")}
        names={row.map((control) => control.title)}
      />
      <PlacementList
        label={t("settingsToolbarPlacementTray")}
        names={tray.map((control) => control.title)}
      />
    </section>
  );
}
