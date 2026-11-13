import type { PermissionMode } from "@vibeallday/shared";
import { useI18n } from "../i18n";
import { FilterDropdown, type FilterOption } from "./FilterDropdown";
import { AlertIcon, CheckIcon } from "./garden/icons";
import { type BadgeTone, Tag } from "./garden/Badge";
import styles from "./NewSessionPermissionChip.module.css";

type Risk = "low" | "medium" | "high";

const PERMISSION_RISK: Record<PermissionMode, Risk> = {
  default: "low",
  plan: "low",
  acceptEdits: "medium",
  auto: "medium",
  bypassPermissions: "high",
};

const RISK_RANK: Record<Risk, number> = { low: 0, medium: 1, high: 2 };

const RISK_TONE: Record<Risk, BadgeTone> = {
  low: "accent",
  medium: "attn",
  high: "err",
};

const RISK_LABEL_KEY = {
  low: "newSessionRiskLow",
  medium: "newSessionRiskMedium",
  high: "newSessionRiskHigh",
} as const;

const MARK_SIZE = 14;

interface NewSessionPermissionChipProps {
  modes: readonly PermissionMode[];
  value: PermissionMode;
  labels: Record<PermissionMode, string>;
  descriptions: Record<PermissionMode, string>;
  /** Names the menu; the chip shows the shorter "Permissions" key. */
  title: string;
  disabled: boolean;
  onSelect: (mode: PermissionMode) => void;
  triggerClassName?: string;
  keyClassName?: string;
}

/** Modes from lowest to highest risk; equal risks keep their given order. */
export function sortPermissionModesByRisk(
  modes: readonly PermissionMode[],
): PermissionMode[] {
  return [...modes].sort(
    (a, b) => RISK_RANK[PERMISSION_RISK[a]] - RISK_RANK[PERMISSION_RISK[b]],
  );
}

/**
 * The permission chip of the New Session chip row: a menu of the modes the
 * selected model offers, ordered by risk, with bypass set apart in the error
 * tone. Selecting goes through the form's own mode handler.
 */
export function NewSessionPermissionChip({
  modes,
  value,
  labels,
  descriptions,
  title,
  disabled,
  onSelect,
  triggerClassName,
  keyClassName,
}: NewSessionPermissionChipProps) {
  const { t } = useI18n();
  const options = sortPermissionModesByRisk(modes).map(
    (mode, index): FilterOption<PermissionMode> => {
      const risk = PERMISSION_RISK[mode];
      return {
        value: mode,
        label: labels[mode],
        description: descriptions[mode],
        icon:
          risk === "high" ? (
            <AlertIcon size={MARK_SIZE} className={styles.danger} />
          ) : mode === value ? (
            <CheckIcon size={MARK_SIZE} className={styles.check} />
          ) : (
            <span className={styles.mark} />
          ),
        meta: <Tag tone={RISK_TONE[risk]}>{t(RISK_LABEL_KEY[risk])}</Tag>,
        groupLabelBefore:
          index === 0 ? t("newSessionPermissionMenuGroup") : undefined,
        dividerBefore: risk === "high" && index > 0,
        disabled,
      };
    },
  );
  const risky = PERMISSION_RISK[value] === "high";
  return (
    <FilterDropdown<PermissionMode>
      label={title}
      options={options}
      selected={[value]}
      onChange={([mode]) => {
        if (mode && !disabled) onSelect(mode);
      }}
      multiSelect={false}
      triggerClassName={triggerClassName}
      triggerContent={
        <span className={styles.trigger} data-risk={risky ? "high" : undefined}>
          <span className={keyClassName}>
            {t("newSessionPermissionChipLabel")}
          </span>
          <span className={styles.value}>{labels[value]}</span>
        </span>
      }
    />
  );
}
