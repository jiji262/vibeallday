import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

type Length = number | string;

interface SkeletonProps {
  width?: Length;
  height?: Length;
  radius?: Length;
  className?: string;
}

const DEFAULT_TEXT_LINES = 3;
const LAST_LINE_WIDTH = "60%";
const TEXT_LINE_HEIGHT = 10;

function toCss(value: Length | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/** A shimmering placeholder block; static under reduced motion. */
export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  const style = {
    "--skeleton-width": toCss(width),
    "--skeleton-height": toCss(height),
    "--skeleton-radius": toCss(radius),
  } as CSSProperties;
  return (
    <span
      className={
        className ? `${styles.skeleton} ${className}` : styles.skeleton
      }
      style={style}
      aria-hidden="true"
    />
  );
}

/** Paragraph placeholder: full lines with a shorter last line. */
export function SkeletonText({
  lines = DEFAULT_TEXT_LINES,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const keys = Array.from({ length: Math.max(1, lines) }, (_, i) => i);
  return (
    <span
      className={className ? `${styles.text} ${className}` : styles.text}
      aria-hidden="true"
    >
      {keys.map((line) => (
        <Skeleton
          key={line}
          height={TEXT_LINE_HEIGHT}
          width={
            line === keys.length - 1 && keys.length > 1
              ? LAST_LINE_WIDTH
              : "100%"
          }
        />
      ))}
    </span>
  );
}
