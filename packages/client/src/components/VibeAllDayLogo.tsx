import { BrandWordmark } from "./BrandWordmark";

interface VibeAllDayGlyphProps {
  className?: string;
  size?: number;
}

export function VibeAllDayGlyph({
  className = "",
  size = 24,
}: VibeAllDayGlyphProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect width="120" height="120" rx="26" fill="#2563eb" />
      <path
        d="M 28 32 L 60 88 L 92 32"
        fill="none"
        stroke="#ffffff"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * VibeAllDayLogo - Brand logo component with dark/light mode support.
 *
 * Displays the full vibeallday wordmark with the app icon.
 * Automatically adapts colors based on current theme.
 */

interface VibeAllDayLogoProps {
  /** Show compact version (icon + text) vs just text */
  showIcon?: boolean;
  /** Additional className for styling */
  className?: string;
}

export function VibeAllDayLogo({
  showIcon = true,
  className = "",
}: VibeAllDayLogoProps) {
  return (
    <span className={`vibeallday-logo ${className}`}>
      {showIcon && <VibeAllDayGlyph className="vibeallday-logo-icon" />}
      <span className="vibeallday-logo-text">
        <BrandWordmark variant="full" />
      </span>
    </span>
  );
}
