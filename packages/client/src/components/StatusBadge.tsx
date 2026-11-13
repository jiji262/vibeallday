import type { AgentActivity } from "../hooks/useFileActivity";
import { useI18n } from "../i18n";
import type { SessionStatus } from "../types";
import { Badge, type BadgeTone } from "./garden/Badge";
import { Status } from "./garden/StatusDot";
import { ThinkingIndicator } from "./ThinkingIndicator";

type BadgeVariant = "self" | "external" | "none";
type NotificationVariant = "needs-input" | "unread";
type PendingInputType = "tool-approval" | "user-question";

interface SessionStatusBadgeProps {
  /** Session ownership object */
  status: SessionStatus;
  /** Type of pending input if session needs user action */
  pendingInputType?: PendingInputType;
  /** Whether session has unread content */
  hasUnread?: boolean;
  /** Current agent activity (in-turn/waiting-input) for activity indicators */
  activity?: AgentActivity;
}

interface CountBadgeProps {
  /** Badge variant */
  variant: BadgeVariant;
  /** Count to display (e.g., "2 Active") */
  count: number;
}

interface NotificationBadgeProps {
  /** Type of notification badge */
  variant: NotificationVariant;
  /** Optional label override */
  label?: string;
}

function getCountBadgeStatusClass(
  variant: BadgeVariant,
): "idle" | "owned" | "external" {
  if (variant === "self") return "owned";
  if (variant === "external") return "external";
  return "idle";
}

/** Design status map: owned and active = run, external and idle = idle. */
const COUNT_BADGE_TONE: Record<BadgeVariant, BadgeTone> = {
  self: "run",
  external: "idle",
  none: "idle",
};

/**
 * Notification badge indicating action needed or unread content.
 * - "needs-input" (attn, filled circle): tool approval or user question
 * - "unread" (idle): new content since last viewed
 */
export function NotificationBadge({ variant, label }: NotificationBadgeProps) {
  const { t } = useI18n();
  const defaultLabel = t(
    variant === "needs-input" ? "statusBadgeInputNeeded" : "statusBadgeUnread",
  );

  const className = `status-badge notification-${variant}`;
  if (variant === "needs-input") {
    return (
      <Status state="attn" className={className}>
        {label ?? defaultLabel}
      </Status>
    );
  }
  return (
    <Badge tone="idle" className={className}>
      {label ?? defaultLabel}
    </Badge>
  );
}

/**
 * Status badge for a single session in a list.
 * Priority: needs-input (attn) > in-turn (thinking) > idle (nothing)
 * External sessions always show "External" badge regardless of other state.
 */
export function SessionStatusBadge({
  status,
  pendingInputType,
  activity,
}: SessionStatusBadgeProps) {
  const { t } = useI18n();
  // External sessions always show the external badge
  // We can't track fine-grained state (in-turn, needs input) for external sessions
  if (status.owner === "external") {
    return (
      <Badge tone="idle" className="status-badge status-external">
        {t("sessionHeaderStateExternal")}
      </Badge>
    );
  }

  // Priority 1: Needs input (tool approval or user question)
  if (pendingInputType) {
    const label = t(
      pendingInputType === "tool-approval"
        ? "statusBadgeApprovalNeeded"
        : "statusBadgeQuestion",
    );
    return <NotificationBadge variant="needs-input" label={label} />;
  }

  // Priority 2: In-turn (agent is thinking) - show pulsing indicator
  if (activity === "in-turn") {
    return <ThinkingIndicator variant="pill" />;
  }

  // Unread content is now handled via CSS class on session list item
  // (bold/bright text like Gmail instead of a badge)

  // Active sessions (self-owned) don't need a separate indicator - "Thinking" badge
  // already shows when the process is actively in-turn
  return null;
}

/**
 * Status badge showing a count of active sessions.
 * Used on the projects list page.
 */
export function ActiveCountBadge({ variant, count }: CountBadgeProps) {
  if (count === 0) return null;

  const label =
    variant === "self"
      ? `${count} Active`
      : variant === "external"
        ? `${count} External`
        : null;

  if (!label) return null;

  return (
    <Badge
      tone={COUNT_BADGE_TONE[variant]}
      className={`status-badge status-${getCountBadgeStatusClass(variant)}`}
    >
      {label}
    </Badge>
  );
}
