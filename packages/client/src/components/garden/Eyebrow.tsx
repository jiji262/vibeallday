import { Fragment, type ReactNode } from "react";
import styles from "./Eyebrow.module.css";

const SEPARATOR = " · ";

interface EyebrowProps {
  /** Context segments, joined with " · ". Empty parts are skipped. */
  parts?: ReactNode[];
  children?: ReactNode;
  tone?: "default" | "rose";
  className?: string;
  id?: string;
}

/** Mono UPPERCASE context line above a title or a danger zone. */
export function Eyebrow({
  parts,
  children,
  tone = "default",
  className,
  id,
}: EyebrowProps) {
  const visible = (parts ?? []).filter(
    (part) =>
      part !== null && part !== undefined && part !== false && part !== "",
  );
  const classes = [
    styles.eyebrow,
    tone === "rose" ? styles.rose : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <p className={classes} id={id}>
      {visible.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? SEPARATOR : null}
          {part}
        </Fragment>
      ))}
      {visible.length > 0 && children ? SEPARATOR : null}
      {children}
    </p>
  );
}
