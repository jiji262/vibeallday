import {
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../i18n";
import { SearchField as SearchInput } from "../garden/Field";
import type { SearchField } from "./model";
import styles from "./SearchToolbar.module.css";

/** Printable needle characters are capped so a held key cannot grow the URL. */
const MAX_NEEDLE_LENGTH = 512;
/** Desktop-like layouts focus the search field and capture typing for it. */
const DESKTOP_QUERY = "(min-width: 701px)";
const OPEN_DIALOG = '[role="dialog"],dialog[open]';

/**
 * The needle field. It owns keyboard echo (the draft never waits on router
 * navigation), the desktop "just start typing" capture and the Ctrl-S /
 * Ctrl-R field shortcuts. `trailing` sits beside the field, e.g. Filters.
 */
export function SearchHeader({
  query,
  onQuery,
  onFields,
  supported,
  supportKnown = true,
  trailing,
}: {
  query: string;
  onQuery(value: string): void;
  onFields(value: SearchField[]): void;
  supported: boolean;
  /**
   * Whether the capability read behind `supported` has resolved. While it has
   * not, `supported` is merely "not yet known", so a C-s/C-r press is held
   * rather than dropped: see the pending-field effect below.
   */
  supportKnown?: boolean;
  trailing?: ReactNode;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const pendingField = useRef<SearchField | null>(null);
  // Router navigation is deferred work; it must never own keyboard echo.
  const [draft, setDraft] = useState(query);
  const draftValue = useRef(query);
  const pendingQueries = useRef<string[]>([]);
  const editQuery = useCallback(
    (value: string) => {
      draftValue.current = value;
      setDraft(value);
      pendingQueries.current.push(value);
      startTransition(() => onQuery(value));
    },
    [onQuery],
  );
  useEffect(() => {
    const acknowledged = pendingQueries.current.lastIndexOf(query);
    if (acknowledged >= 0) {
      pendingQueries.current.splice(0, acknowledged + 1);
      if (pendingQueries.current.length) return;
    } else {
      // A URL change that we did not send (e.g. Back) replaces the draft.
      pendingQueries.current = [];
    }
    draftValue.current = query;
    setDraft(query);
  }, [query]);
  useEffect(() => {
    if (
      matchMedia(DESKTOP_QUERY).matches &&
      !document.querySelector(OPEN_DIALOG)
    )
      input.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const editable =
      'input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="menu"],[role="dialog"]';
    // Space presses whatever control has focus, so that key stays with the
    // control: capturing it means Tab to a chip or checkbox and press Space
    // toggles nothing and lands a space in the needle. Characters the control
    // ignores remain needle input, so clicking a chip and continuing to type
    // still reaches the search.
    const pressable =
      'button,summary,a[href],input[type="checkbox"],input[type="radio"],[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[role="menuitem"],[role="option"],[tabindex]:not([tabindex="-1"])';
    const type = (event: KeyboardEvent) => {
      const search = input.current;
      const target = event.target instanceof Element ? event.target : null;
      if (
        !search ||
        document.activeElement === search ||
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !matchMedia(DESKTOP_QUERY).matches ||
        document.querySelector(OPEN_DIALOG) ||
        target?.closest(editable) ||
        (event.key === " " && target?.closest(pressable))
      )
        return;
      const printable = [...event.key].length === 1;
      if (!printable && event.key !== "Backspace" && event.key !== "Delete")
        return;
      event.preventDefault();
      search.focus({ preventScroll: true });
      search.setSelectionRange(search.value.length, search.value.length);
      const value = draftValue.current;
      editQuery(
        printable
          ? value.length + event.key.length <= MAX_NEEDLE_LENGTH
            ? value + event.key
            : value
          : event.key === "Backspace"
            ? [...value].slice(0, -1).join("")
            : value,
      );
    };
    document.addEventListener("keydown", type);
    return () => document.removeEventListener("keydown", type);
  }, [editQuery]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        !event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        !["s", "r"].includes(event.key.toLowerCase())
      )
        return;
      event.preventDefault();
      const field = event.key.toLowerCase() === "s" ? "assistant" : "user";
      // The capability read that decides `supported` is a fetch, so a press
      // landing in the first moments of the page would otherwise vanish: the
      // field checkboxes are still disabled and this handler had nothing to
      // apply. Hold it instead, and apply it when the answer arrives.
      if (supported) onFields([field]);
      else if (!supportKnown) pendingField.current = field;
      input.current?.focus();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onFields, supported, supportKnown]);
  useEffect(() => {
    const field = pendingField.current;
    if (!field || !supportKnown) return;
    pendingField.current = null;
    // A read that resolved to "unsupported" answers the held press: there is
    // no content search to turn on, so it is discarded rather than queued.
    if (supported) onFields([field]);
  }, [onFields, supported, supportKnown]);
  const field = (
    <SearchInput
      ref={input}
      className={styles.field}
      label={t("globalSessionsSearchPlaceholder")}
      placeholder={t("globalSessionsSearchPlaceholder")}
      value={draft}
      maxLength={MAX_NEEDLE_LENGTH}
      onChange={(e) => editQuery(e.target.value)}
    />
  );
  if (!trailing) return field;
  return (
    <div className={styles.searchRow}>
      {field}
      {trailing}
    </div>
  );
}
