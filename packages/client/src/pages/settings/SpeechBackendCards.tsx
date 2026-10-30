import { useId } from "react";
import type { FilterOption } from "../../components/FilterDropdown";
import { Status, type StatusState } from "../../components/garden/StatusDot";
import { type MessageKey, useI18n } from "../../i18n";
import {
  DEFAULT_SPEECH_METHOD,
  type SpeechMethodId,
} from "../../lib/speechProviders/methods";
import styles from "./SpeechBackendCards.module.css";

type SpeechCategory = "browser" | "local" | "cloud";
type MethodState = "available" | "validating" | "unavailable";

const CATEGORY_ORDER: readonly SpeechCategory[] = ["browser", "local", "cloud"];

/** Server backends that transcribe on the VibeAllDay host itself. */
const HOST_LOCAL_BACKENDS: ReadonlySet<SpeechMethodId> = new Set([
  "vibeallday-whisper",
  "vibeallday-parakeet",
  "vibeallday-nemo",
  "vibeallday-granite",
  "vibeallday-qwen",
  "vibeallday-dummy",
]);

const CATEGORY_COPY: Record<
  SpeechCategory,
  { title: MessageKey; description: MessageKey }
> = {
  browser: {
    title: "speechCardBrowserTitle",
    description: "speechCardBrowserDescription",
  },
  local: {
    title: "speechCardLocalTitle",
    description: "speechCardLocalDescription",
  },
  cloud: {
    title: "speechCardCloudTitle",
    description: "speechCardCloudDescription",
  },
};

const CARD_STATUS: Record<
  "available" | "validating" | "none" | "unavailable",
  { state: StatusState; label: MessageKey }
> = {
  available: { state: "ok", label: "speechCardStatusAvailable" },
  validating: { state: "run", label: "speechCardStatusValidating" },
  none: { state: "idle", label: "speechCardStatusNotSetUp" },
  unavailable: { state: "err", label: "speechCardStatusUnavailable" },
};

function categoryOf(id: SpeechMethodId): SpeechCategory {
  if (id === DEFAULT_SPEECH_METHOD) return "browser";
  return HOST_LOCAL_BACKENDS.has(id) ? "local" : "cloud";
}

export interface SpeechBackendStatusEntry {
  id: string;
  validationStatus?: string;
}

interface CardMethod {
  id: SpeechMethodId;
  label: string;
  state: MethodState;
}

function methodState(
  option: FilterOption<SpeechMethodId>,
  status: SpeechBackendStatusEntry | undefined,
): MethodState {
  if (status?.validationStatus === "pending") return "validating";
  return option.disabled ? "unavailable" : "available";
}

function cardStatusKey(methods: readonly CardMethod[]) {
  if (methods.length === 0) return CARD_STATUS.none;
  if (methods.some((method) => method.state === "available")) {
    return CARD_STATUS.available;
  }
  if (methods.some((method) => method.state === "validating")) {
    return CARD_STATUS.validating;
  }
  return CARD_STATUS.unavailable;
}

interface SpeechCategoryCardProps {
  category: SpeechCategory;
  methods: readonly CardMethod[];
  selected: CardMethod | undefined;
  onSelect: (id: SpeechMethodId) => void;
}

function SpeechCategoryCard({
  category,
  methods,
  selected,
  onSelect,
}: SpeechCategoryCardProps) {
  const { t } = useI18n();
  const id = useId();
  const copy = CATEGORY_COPY[category];
  const status = cardStatusKey(methods);
  const firstAvailable = methods.find((method) => method.state === "available");
  const available = methods.filter((method) => method.state === "available");
  const detail = selected
    ? selected.label
    : available.map((method) => method.label).join(" · ");
  return (
    <button
      type="button"
      className={styles.card}
      aria-pressed={selected !== undefined}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      data-speech-category={category}
      disabled={!selected && !firstAvailable}
      onClick={() => {
        if (!selected && firstAvailable) onSelect(firstAvailable.id);
      }}
    >
      <span className={styles.head}>
        <span id={`${id}-title`} className={styles.title}>
          {t(copy.title)}
        </span>
        <Status state={status.state} className={styles.status}>
          {t(status.label)}
        </Status>
      </span>
      <span id={`${id}-desc`} className={styles.description}>
        {t(copy.description)}
      </span>
      {detail || selected ? (
        <span className={styles.tags}>
          {selected ? (
            <span className={`${styles.chip} ${styles.inUse}`}>
              {t("speechCardInUse")}
            </span>
          ) : null}
          {detail ? (
            <span className={`${styles.chip} ${styles.detail}`}>{detail}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Backend picker as three category cards (browser / host / cloud), each with
 * the availability of the backends it covers. A card picks the first
 * available backend of its kind; the dropdown below picks an exact one.
 */
export function SpeechBackendCards({
  options,
  statuses,
  selectedBackend,
  onSelect,
}: {
  options: readonly FilterOption<SpeechMethodId>[];
  statuses: readonly SpeechBackendStatusEntry[];
  selectedBackend: SpeechMethodId | null;
  onSelect: (id: SpeechMethodId) => void;
}) {
  const { t } = useI18n();
  const methods: CardMethod[] = options.map((option) => ({
    id: option.value,
    label: option.label,
    state: methodState(
      option,
      statuses.find((entry) => entry.id === option.value),
    ),
  }));
  return (
    <div
      className={styles.grid}
      role="group"
      aria-label={t("speechCardsGroupLabel")}
    >
      {CATEGORY_ORDER.map((category) => {
        const inCategory = methods.filter(
          (method) => categoryOf(method.id) === category,
        );
        return (
          <SpeechCategoryCard
            key={category}
            category={category}
            methods={inCategory}
            selected={inCategory.find(
              (method) => method.id === selectedBackend,
            )}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
