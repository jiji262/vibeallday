import { useI18n } from "../i18n";
import type { ContextUsage } from "../types";

interface ContextUsageIndicatorProps {
  /** Context usage data */
  usage?: ContextUsage;
  /** Size of the indicator in pixels (default: 16) */
  size?: number;
  /** Whether to show the percentage label (default: true) */
  showLabel?: boolean;
}

const CONTEXT_ERR_PERCENT = 90;
const CONTEXT_ATTN_PERCENT = 75;

/**
 * Context ring: an accent arc over a quiet track, turning amber near the
 * window and red when nearly full, with the percentage beside it.
 */
export function ContextUsageIndicator({
  usage,
  size = 16,
  showLabel = true,
}: ContextUsageIndicatorProps) {
  const { t } = useI18n();
  if (!usage) return null;

  const { percentage } = usage;
  // Clamp percentage to 0-100
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const displayPercentage = Math.round(clampedPercentage);
  const tooltipPercentage = formatPercentage(clampedPercentage);

  // Calculate the stroke-dasharray for the pie chart
  // Circumference of circle with r=8 (for size=16) = 2 * PI * r
  const radius = size / 2 - 1; // Leave 1px for stroke
  const circumference = 2 * Math.PI * radius;
  const filled = (clampedPercentage / 100) * circumference;

  const getFillColor = () => {
    if (clampedPercentage >= CONTEXT_ERR_PERCENT) return "var(--err)";
    if (clampedPercentage >= CONTEXT_ATTN_PERCENT) return "var(--attn)";
    return "var(--accent)";
  };

  const tooltip = usage.contextWindow
    ? t("contextTooltipWithWindow", {
        percentage: tooltipPercentage,
        used: formatTokens(usage.inputTokens),
        total: formatTokens(usage.contextWindow),
      })
    : t("contextTooltipNoWindow", {
        percentage: tooltipPercentage,
        used: formatTokens(usage.inputTokens),
      });

  return (
    <span className="context-usage-indicator" title={tooltip}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="context-usage-pie"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="2"
        />
        {/* Used arc, rotated -90deg so it starts from the top */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getFillColor()}
          strokeWidth="2"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && (
        <span className="context-usage-label">{displayPercentage}%</span>
      )}
    </span>
  );
}

/**
 * Format token count for display (e.g., 34500 -> "34.5K")
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function formatPercentage(percentage: number): string {
  return percentage.toFixed(1).replace(/\.0$/, "");
}
