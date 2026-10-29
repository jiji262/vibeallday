import { useId } from "react";
import { BrandWordmark } from "./BrandWordmark";
import styles from "./VibeAllDayLogo.module.css";

interface VibeAllDayGlyphProps {
  className?: string;
  size?: number;
}

/** The V mark on an indigo-to-rose tile, drawn from theme tokens. */
export function VibeAllDayGlyph({
  className = "",
  size = 28,
}: VibeAllDayGlyphProps) {
  const gradientId = `vibeallday-glyph-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--indigo)" }} />
          <stop offset="1" style={{ stopColor: "var(--rose)" }} />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="34" fill={`url(#${gradientId})`} />
      <path
        d="M 30 34 L 60 88 L 90 34"
        fill="none"
        style={{ stroke: "var(--ink-on)" }}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface VibeAllDayLogoProps {
  /** Show the tile beside the wordmark */
  showIcon?: boolean;
  /** Mono release tag after the wordmark, e.g. "v0.10.2" */
  version?: string;
  /** Additional className for styling */
  className?: string;
}

/** Brand lockup: gradient tile, serif wordmark and an optional version tag. */
export function VibeAllDayLogo({
  showIcon = true,
  version,
  className = "",
}: VibeAllDayLogoProps) {
  return (
    <span className={`vibeallday-logo ${styles.logo} ${className}`.trim()}>
      {showIcon && (
        <VibeAllDayGlyph className={`vibeallday-logo-icon ${styles.icon}`} />
      )}
      <span className={`vibeallday-logo-text ${styles.text}`}>
        <BrandWordmark variant="full" />
        {version ? <span className={styles.version}>{version}</span> : null}
      </span>
    </span>
  );
}
