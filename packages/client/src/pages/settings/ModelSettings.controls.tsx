import type {
  EffortLevel,
  PermissionMode,
  ProviderInfo,
  ProviderName,
  ThinkingMode,
} from "@vibeallday/shared";
import { Tag } from "../../components/garden/Badge";
import { ProviderMark } from "../../components/garden/ProviderMark";
import { Segmented } from "../../components/garden/Segmented";
import { useI18n } from "../../i18n";
import type { EffortLevelOption } from "../../lib/effortLevels";
import styles from "./ModelSettings.module.css";

/** Risk steps drawn by the permission card meter (design .smd-risk). */
const RISK_STEPS = 4;

type RiskTone = "ok" | "attn" | "err";

interface PermissionRisk {
  level: number;
  tone: RiskTone;
  labelKey:
    | "settingsModelRiskLow"
    | "settingsModelRiskMedium"
    | "settingsModelRiskHigh"
    | "settingsModelRiskDanger";
}

const PERMISSION_RISK: Record<PermissionMode, PermissionRisk> = {
  default: { level: 1, tone: "ok", labelKey: "settingsModelRiskLow" },
  plan: { level: 1, tone: "ok", labelKey: "settingsModelRiskLow" },
  auto: { level: 2, tone: "attn", labelKey: "settingsModelRiskMedium" },
  acceptEdits: { level: 3, tone: "attn", labelKey: "settingsModelRiskHigh" },
  bypassPermissions: {
    level: RISK_STEPS,
    tone: "err",
    labelKey: "settingsModelRiskDanger",
  },
};

const RISK_TONE_CLASS: Record<RiskTone, string | undefined> = {
  ok: undefined,
  attn: styles.riskAttn,
  err: styles.riskErr,
};

interface ProviderSegmentedProps {
  providers: readonly ProviderInfo[];
  value: ProviderName | undefined;
  disabled: boolean;
  onChange: (provider: ProviderName) => void;
}

/** Picks the default provider; the rows below show that provider's defaults. */
export function ProviderSegmented({
  providers,
  value,
  disabled,
  onChange,
}: ProviderSegmentedProps) {
  const { t } = useI18n();
  if (providers.length === 0 || value === undefined) return null;
  return (
    <Segmented<ProviderName>
      label={t("settingsModelProviderTabsLabel")}
      className={styles.providerSeg}
      value={value}
      onChange={onChange}
      options={providers.map((provider) => ({
        value: provider.name,
        disabled,
        label: (
          <>
            <ProviderMark provider={provider.name} size="sm" />
            {provider.displayName}
          </>
        ),
      }))}
    />
  );
}

function RiskMeter({ mode }: { mode: PermissionMode }) {
  const { t } = useI18n();
  const risk = PERMISSION_RISK[mode];
  const steps = Array.from({ length: RISK_STEPS }, (_, index) => index);
  return (
    <span
      className={[styles.risk, RISK_TONE_CLASS[risk.tone]]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={t(risk.labelKey)}
    >
      {steps.map((step) => (
        <span
          key={step}
          className={step < risk.level ? styles.riskOn : undefined}
        />
      ))}
    </span>
  );
}

/** Lowest risk first, matching the design's top-to-bottom ordering. */
export function sortPermissionModesByRisk(
  modes: readonly PermissionMode[],
): PermissionMode[] {
  return modes
    .map((mode, index) => ({ mode, index }))
    .sort(
      (a, b) =>
        PERMISSION_RISK[a.mode].level - PERMISSION_RISK[b.mode].level ||
        a.index - b.index,
    )
    .map(({ mode }) => mode);
}

interface PermissionModeCardsProps {
  /** Names the radio group; also used as the radio `name` prefix. */
  label: string;
  modes: readonly PermissionMode[];
  value: PermissionMode;
  labels: Record<PermissionMode, string>;
  descriptions: Record<PermissionMode, string>;
  disabled: boolean;
  onChange: (mode: PermissionMode) => void;
}

/** Permission mode as risk-coloured radio cards (design .smd-perm). */
export function PermissionModeCards({
  label,
  modes,
  value,
  labels,
  descriptions,
  disabled,
  onChange,
}: PermissionModeCardsProps) {
  const { t } = useI18n();
  return (
    <div className={styles.permGrid} role="radiogroup" aria-label={label}>
      {sortPermissionModesByRisk(modes).map((mode) => {
        const danger = PERMISSION_RISK[mode].tone === "err";
        return (
          <label
            key={mode}
            className={[styles.perm, danger ? styles.permDanger : null]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              name="session-default-permission-mode"
              value={mode}
              checked={value === mode}
              disabled={disabled}
              onChange={() => onChange(mode)}
            />
            <span className={styles.permBody}>
              <span className={styles.permHead}>
                <span className={styles.permName}>{labels[mode]}</span>
                {mode === "default" && (
                  <Tag>{t("settingsModelDefaultTag")}</Tag>
                )}
                {danger && <Tag tone="err">{t("settingsModelDangerTag")}</Tag>}
                <RiskMeter mode={mode} />
              </span>
              <span className={styles.permDesc}>{descriptions[mode]}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Never matches an effort option, so no effort reads as selected. */
const NO_EFFORT = "";

interface ThinkingDefaultsProps {
  mode: ThinkingMode;
  modeOptions: readonly ThinkingMode[];
  level: EffortLevel | undefined;
  effortOptions: readonly EffortLevelOption[];
  onSetMode: (mode: ThinkingMode) => void;
  /** Picking an effort also turns thinking on, as in the composer menu. */
  onSetEffort: (level: EffortLevel) => void;
}

const THINKING_MODE_ORDER: ThinkingMode[] = ["auto", "off", "on"];

const THINKING_LABEL_KEYS = {
  off: "modelSettingsThinkingOffLabel",
  auto: "modelSettingsThinkingAutoLabel",
  on: "modelSettingsThinkingOnLabel",
} as const satisfies Record<ThinkingMode, string>;

/** Thinking mode and effort as two Segmented controls. */
export function ThinkingDefaults({
  mode,
  modeOptions,
  level,
  effortOptions,
  onSetMode,
  onSetEffort,
}: ThinkingDefaultsProps) {
  const { t } = useI18n();
  const modes = THINKING_MODE_ORDER.filter((m) => modeOptions.includes(m));
  const showEffort = modes.includes("on") && effortOptions.length > 0;
  return (
    <div className={styles.thinkingStack}>
      <div className={styles.thinkingRow}>
        <span className={styles.thinkingLabel}>
          {t("modelSettingsThinkingTitle")}
        </span>
        <Segmented<ThinkingMode>
          label={t("modelSettingsThinkingTitle")}
          value={mode}
          onChange={onSetMode}
          options={modes.map((m) => ({
            value: m,
            label: t(THINKING_LABEL_KEYS[m]),
          }))}
        />
      </div>
      {showEffort && (
        <div className={styles.thinkingRow}>
          <span className={styles.thinkingLabel}>
            {t("modelSettingsEffortTitle")}
          </span>
          <Segmented<string>
            label={t("modelSettingsEffortTitle")}
            className={styles.effortSeg}
            value={mode === "on" && level ? level : NO_EFFORT}
            onChange={(next) => onSetEffort(next as EffortLevel)}
            options={effortOptions.map((option) => ({
              value: option.value,
              label: <span title={option.description}>{option.label}</span>,
            }))}
          />
        </div>
      )}
    </div>
  );
}
