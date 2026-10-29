import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
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
import {
  type PaletteGroup,
  type PaletteItem,
  type PaletteSection,
  stepIndex,
} from "./paletteData";
import { usePaletteSections } from "./usePaletteSections";

const FIELD_ICON_SIZE = 18;
const ROW_ICON_SIZE = 16;
/** The field takes focus when the palette mounts. */
const focusOnMount = (input: HTMLInputElement | null) => input?.focus();
const STEP_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

const GROUP_LABEL: Record<PaletteGroup, MessageKey | null> = {
  search: null,
  jump: "paletteGroupJump",
  projects: "paletteGroupProjects",
  recent: "paletteGroupRecent",
  settings: "paletteGroupSettings",
};

interface CommandPaletteProps {
  onClose: () => void;
}

interface RowProps {
  item: PaletteItem;
  optionId: string;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}

function PaletteRow({ item, optionId, active, onHover, onChoose }: RowProps) {
  const Icon = item.Icon;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: rows are chosen from the combobox's Arrow/Enter keys; the field keeps focus
    <div
      id={optionId}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      className={active ? `${styles.row} ${styles.active}` : styles.row}
      onMouseMove={active ? undefined : onHover}
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={onChoose}
    >
      {Icon ? <Icon size={ROW_ICON_SIZE} className={styles.rowIcon} /> : null}
      <span className={styles.rowLabel}>{item.label}</span>
      {item.hint ? <span className={styles.rowHint}>{item.hint}</span> : null}
    </div>
  );
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
    navigate(`${basePath}${item.to}`);
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
      // The field is the palette's only tab stop; rows move by arrow keys.
      event.preventDefault();
    }
  };

  return { activeIndex, setActive, choose, handleKeyDown };
}

interface ResultsProps {
  listId: string;
  sections: readonly PaletteSection[];
  showEmpty: boolean;
  optionId: (index: number) => string;
  navigation: PaletteNavigation;
}

function PaletteResults({
  listId,
  sections,
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

/** ⌘K palette: jump to destinations, projects, recent sessions, settings. */
export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const sections = usePaletteSections(query);
  const rows = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const navigation = usePaletteNavigation(rows, onClose);
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
        showEmpty={rows.length === 1 && query.trim() !== ""}
        optionId={optionId}
        navigation={navigation}
      />
    </PaletteScrim>,
    document.body,
  );
}
