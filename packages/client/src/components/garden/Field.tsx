import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
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

/** Multi-line text recipe: the input look with a 96px minimum and resize. */
export function textareaClassName(className?: string): string {
  return join(styles.control, styles.textarea, className);
}

interface FieldProps {
  label: ReactNode;
  /** id of the control the label names. */
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label, control and optional hint stacked (design .field). */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: FieldProps) {
  return (
    <div className={join(styles.field, className)}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
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
