interface BrandWordmarkProps {
  className?: string;
  variant?: "short" | "full";
}

export function BrandWordmark({
  className = "",
  variant = "short",
}: BrandWordmarkProps) {
  return (
    <span
      className={`brand-wordmark brand-wordmark--${variant} ${className}`.trim()}
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
