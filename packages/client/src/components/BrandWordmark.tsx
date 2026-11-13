import styles from "./BrandWordmark.module.css";

interface BrandWordmarkProps {
  className?: string;
  variant?: "short" | "full";
}

/** Serif product name; `--brand-wordmark-size` on the element resizes it. */
export function BrandWordmark({
  className = "",
  variant = "short",
}: BrandWordmarkProps) {
  return (
    <span
      className={`brand-wordmark brand-wordmark--${variant} ${styles.wordmark} ${className}`.trim()}
    >
      VibeAllDay
    </span>
  );
}

export function isVibeAllDayBrandName(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  return value.toLowerCase().replace(/[\s_-]+/g, "") === "vibeallday";
}
