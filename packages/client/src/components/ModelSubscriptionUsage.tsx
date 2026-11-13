import {
  getAccountSubscriptionUsageWindow,
  getModelSubscriptionUsageWindow,
  getMostUsedSubscriptionUsageWindow,
  type ProviderSubscriptionUsage,
  type ProviderSubscriptionUsageWindow,
} from "@vibeallday/shared";
import { useI18n } from "../i18n";

function UsageBadge({
  window,
  titleKey,
}: {
  window: ProviderSubscriptionUsageWindow | null;
  titleKey?: "subscriptionUsageAccountTitle" | "subscriptionUsageModelTitle";
}) {
  const { t } = useI18n();
  if (!window) return null;
  const percent = Math.round(window.usedPercent);
  const tone = percent >= 90 ? "danger" : percent >= 75 ? "warning" : "neutral";
  return (
    <span
      className={`subscription-usage-badge tone-${tone}`}
      title={t(titleKey ?? "subscriptionUsageCompactTitle", { percent })}
    >
      {t("subscriptionUsageCompact", { percent })}
    </span>
  );
}

/**
 * The quota that binds one model: the most-used window that applies to it,
 * account-wide ones included. For a list with nowhere to state the
 * account-wide window separately, this is the only place a nearly-spent
 * account limit can appear.
 */
export function ModelSubscriptionUsage({
  usage,
  modelId,
}: {
  usage: ProviderSubscriptionUsage | null | undefined;
  modelId: string;
}) {
  return (
    <UsageBadge window={getMostUsedSubscriptionUsageWindow(usage, modelId)} />
  );
}

/**
 * Only a bucket the provider scopes to this model. For a list that shows
 * {@link AccountSubscriptionUsage} once beside it, where repeating the
 * account-wide window down every row would state it as a per-model number.
 */
export function ModelScopedSubscriptionUsage({
  usage,
  modelId,
}: {
  usage: ProviderSubscriptionUsage | null | undefined;
  modelId: string;
}) {
  return (
    <UsageBadge
      window={getModelSubscriptionUsageWindow(usage, modelId)}
      titleKey="subscriptionUsageModelTitle"
    />
  );
}

/** The account-wide quota, for one place beside a list rather than each row. */
export function AccountSubscriptionUsage({
  usage,
}: {
  usage: ProviderSubscriptionUsage | null | undefined;
}) {
  return (
    <UsageBadge
      window={getAccountSubscriptionUsageWindow(usage)}
      titleKey="subscriptionUsageAccountTitle"
    />
  );
}
