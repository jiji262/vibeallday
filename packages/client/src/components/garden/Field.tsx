import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Field.module.css";
import { SearchIcon } from "./icons";

function join(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

/** Garden text-input recipe (40px, line-strong border, indigo focus ring). */
export function inputClassName(className?: string): string {
  return join(styles.control, className);
}

/** Native `<select>` with the garden trigger look: chevron and shadow-xs. */
export function selectClassName(className?: string): string {
  return join(styles.control, styles.select, className);
}

interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Accessible name; the visible hint is `placeholder`. */
  label: string;
  /** Wrapper class, for width or flex sizing in a toolbar. */
  className?: string;
  /** Extra class on the input itself. */
  inputClassName?: string;
}

/**
 * Search box: leading icon plus a mono 13px input. It is a plain input, so
 * the caller owns the value and keystroke echo never waits on filtering.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField(
    { label, className, inputClassName: inputClass, ...input },
    ref,
  ) {
    return (
      <div className={join(styles.search, className)}>
        <SearchIcon size={14} className={styles.searchIcon} />
        <input
          ref={ref}
          type="search"
          aria-label={label}
          className={join(styles.control, styles.searchInput, inputClass)}
          {...input}
        />
      </div>
    );
  },
);
