import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Switch.module.css";

interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> {
  /** Accessible name when no `<label>` points at the switch. */
  label?: string;
}

/**
 * On/off control: a native checkbox exposed as `role="switch"`, so labels,
 * forms, keyboard (Space) and `checked`/`onChange` work as usual. The track is
 * `--sw-w` x `--sw-h`; coarse pointers get a 44px hit area around it.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, checked, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      checked={checked}
      aria-checked={checked}
      aria-label={label}
      className={className ? `${styles.switch} ${className}` : styles.switch}
      {...rest}
    />
  );
});
