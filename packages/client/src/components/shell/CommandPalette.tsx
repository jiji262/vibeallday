import {
  type KeyboardEvent,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { type MessageKey, useI18n } from "../../i18n";
import { useModalLayer } from "../ui/Modal";
import { SearchIcon } from "../garden/icons";
import { Kbd } from "../garden/Kbd";
import styles from "./CommandPalette.module.css";
import { CommandPaletteFooter } from "./CommandPaletteFooter";
import { PaletteRow } from "./CommandPaletteRow";
import {
  normalizeQuery,
  type PaletteGroup,
  type PaletteItem,
  type PaletteSection,
  sectionStarts,
  stepGroup,
  stepIndex,
} from "./paletteData";
import { usePaletteSections } from "./usePaletteSections";

const FIELD_ICON_SIZE = 18;
/** The search row already quotes the query; it carries no marks. */
const NO_TERMS: readonly string[] = [];
/** The field takes focus when the palette mounts. */
const focusOnMount = (input: HTMLInputElement | null) => input?.focus();
const STEP_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

const GROUP_LABEL: Record<PaletteGroup, MessageKey | null> = {
  search: null,
  jump: "paletteGroupJump",
  projects: "paletteGroupProjects",
  recent: "paletteGroupRecent",
  settings: "paletteGroupSettings",
  actions: "paletteGroupActions",
};

interface CommandPaletteProps {
  onClose: () => void;
}

function SectionGroup({
  section,
  children,
}: {
  section: PaletteSection;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const labelKey = GROUP_LABEL[section.group];
  if (!labelKey) return <>{children}</>;
  const label = t(labelKey);
  return (
    <div role="group" aria-label={label} className={styles.group}>
      <p className={styles.groupLabel} aria-hidden="true">
        {label}
      </p>
      {children}
    </div>
  );
}

interface PaletteNavigation {
  activeIndex: number;
  setActive: (index: number) => void;
  choose: (item: PaletteItem | undefined) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

function usePaletteNavigation(
  sections: readonly PaletteSection[],
  rows: readonly PaletteItem[],
  onClose: () => void,
): PaletteNavigation {
  const navigate = useNavigate();
  const basePath = useRemoteBasePath();
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, rows.length - 1);

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    if (item.run) item.run();
    else if (item.to) navigate(`${basePath}${item.to}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const step = STEP_KEYS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setActive(stepIndex(activeIndex, step, rows.length));
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      choose(rows[activeIndex]);
    } else if (event.key === "Tab") {
      // The field is the palette's only tab stop; Tab moves between groups.
      event.preventDefault();
      const delta = event.shiftKey ? -1 : 1;
      setActive(stepGroup(sectionStarts(sections), activeIndex, delta));
    }
  };

  return { activeIndex, setActive, choose, handleKeyDown };
}

interface ResultsProps {
  listId: string;
  sections: readonly PaletteSection[];
  /** Normalized terms of the query the sections were built from. */
  terms: readonly string[];
  showEmpty: boolean;
  optionId: (index: number) => string;
  navigation: PaletteNavigation;
}

function PaletteResults({
  listId,
  sections,
  terms,
  showEmpty,
  optionId,
  navigation,
}: ResultsProps) {
  const { t } = useI18n();
  const { activeIndex, setActive, choose } = navigation;
  let rowIndex = 0;
  return (
    <div
      id={listId}
      role="listbox"
      aria-label={t("paletteResultsLabel")}
      className={styles.list}
    >
      {sections.map((section) => (
        <SectionGroup key={section.group} section={section}>
          {section.items.map((item) => {
            const index = rowIndex++;
            return (
              <PaletteRow
                key={item.id}
                item={item}
                optionId={optionId(index)}
                active={index === activeIndex}
                terms={section.group === "search" ? NO_TERMS : terms}
                onHover={() => setActive(index)}
                onChoose={() => choose(item)}
              />
            );
          })}
        </SectionGroup>
      ))}
      {showEmpty ? <p className={styles.empty}>{t("paletteEmpty")}</p> : null}
    </div>
  );
}

interface FieldProps {
  listId: string;
  activeOptionId: string;
  query: string;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

function PaletteField({
  listId,
  activeOptionId,
  query,
  onQueryChange,
  onKeyDown,
}: FieldProps) {
  const { t } = useI18n();
  return (
    <div className={styles.field}>
      <SearchIcon size={FIELD_ICON_SIZE} className={styles.fieldIcon} />
      <input
        className={styles.input}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-label={t("paletteInputPlaceholder")}
        placeholder={t("paletteInputPlaceholder")}
        value={query}
        ref={focusOnMount}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <Kbd>{t("kbdEscape")}</Kbd>
    </div>
  );
}

/** Arrow keys move the active row; the list follows it. */
function useActiveRowInView(activeOptionId: string) {
  useEffect(() => {
    document
      .getElementById(activeOptionId)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeOptionId]);
}

/** Dimmed backdrop and the dialog panel; a backdrop click closes. */
function PaletteScrim({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes the palette; Escape closes it through the modal layer
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("paletteDialogLabel")}
        className={styles.panel}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * ⌘K palette: jump to destinations, projects, recent sessions and settings,
 * or run an action (new session, skin toggle, host switch).
 */
export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const sections = usePaletteSections(query);
  // Marks follow the same deferred needle the matched rows were built from.
  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(() => {
    const normalized = normalizeQuery(deferredQuery);
    return normalized ? normalized.split(/\s+/) : [];
  }, [deferredQuery]);
  const rows = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const navigation = usePaletteNavigation(sections, rows, onClose);
  // The palette also opens over modals, and Modal's document-capture Escape
  // closes the topmost layer. Own that slot, or Escape would dismiss the
  // dialog behind instead of the palette.
  useModalLayer(onClose);
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const activeOptionId = optionId(navigation.activeIndex);

  useActiveRowInView(activeOptionId);
  // A new needle re-ranks the list, so the active row returns to the top.
  const editQuery = (value: string) => {
    setQuery(value);
    navigation.setActive(0);
  };

  return createPortal(
    <PaletteScrim onClose={onClose}>
      <PaletteField
        listId={`${baseId}-list`}
        activeOptionId={activeOptionId}
        query={query}
        onQueryChange={editQuery}
        onKeyDown={navigation.handleKeyDown}
      />
      <PaletteResults
        listId={`${baseId}-list`}
        sections={sections}
        terms={terms}
        showEmpty={rows.length === 1 && query.trim() !== ""}
        optionId={optionId}
        navigation={navigation}
      />
      <CommandPaletteFooter />
    </PaletteScrim>,
    document.body,
  );
}
