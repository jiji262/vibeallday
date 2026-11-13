import type { ReactNode } from "react";
import { useI18n } from "../../i18n";
import { InboxIcon, SmartphoneIcon } from "../garden/icons";
import { ProviderMark } from "../garden/ProviderMark";
import { StatusDot } from "../garden/StatusDot";
import { VibeAllDayGlyph } from "../VibeAllDayLogo";
import styles from "./AuthBrandColumn.module.css";

const MARK_SIZE = 28;
const FEATURE_ICON_SIZE = 16;
/** Illustrative command in the static approval card; never executed. */
const PREVIEW_COMMAND = "pnpm --filter @vibeallday/client test";
const PREVIEW_META = "Bash · vibeallday";

function LockIcon() {
  return (
    <svg
      width={FEATURE_ICON_SIZE}
      height={FEATURE_ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Static, decorative approval card: shows what the app is for. */
function ApprovalPreview() {
  const { t } = useI18n();
  return (
    <figure className={styles.preview} aria-hidden="true">
      <div className={styles.previewHead}>
        <StatusDot state="attn" />
        <span>{t("authShellPreviewHead")}</span>
        <span className={styles.previewMeta}>{PREVIEW_META}</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewTitleRow}>
          <ProviderMark provider="claude" />
          <span className={styles.previewTitle}>
            {t("authShellPreviewTitle")}
          </span>
          <span className={styles.previewMeta}>{t("authShellPreviewAge")}</span>
        </div>
        <code className={styles.previewCode}>{PREVIEW_COMMAND}</code>
        <div className={styles.previewActions}>
          <span className={`${styles.chip} ${styles.chipAccent}`}>
            {t("authShellPreviewApprove")}
          </span>
          <span className={styles.chip}>{t("authShellPreviewAlways")}</span>
          <span className={`${styles.chip} ${styles.chipGhost}`}>
            {t("authShellPreviewDeny")}
          </span>
        </div>
      </div>
    </figure>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className={styles.feature}>
      <span className={styles.featureIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.featureText}>
        <span className={styles.featureTitle}>{title}</span>
        <span className={styles.featureBody}>{body}</span>
      </span>
    </li>
  );
}

/**
 * The brand column beside every auth card: wordmark, tagline and, on wide
 * screens, a decorative approval card and three short promises.
 */
export function AuthBrandColumn() {
  const { t } = useI18n();
  return (
    <section className={styles.column} aria-label="VibeAllDay">
      <span className={styles.wordmark}>
        <VibeAllDayGlyph size={MARK_SIZE} className={styles.mark} />
        VibeAllDay
      </span>
      <div className={styles.intro}>
        <p className={styles.tagline}>{t("authShellTagline")}</p>
        <p className={styles.lead}>{t("authShellLead")}</p>
      </div>
      <div className={styles.wideOnly}>
        <ApprovalPreview />
        <ul className={styles.features}>
          <Feature
            icon={<InboxIcon size={FEATURE_ICON_SIZE} />}
            title={t("authShellFeatureInboxTitle")}
            body={t("authShellFeatureInboxBody")}
          />
          <Feature
            icon={<SmartphoneIcon size={FEATURE_ICON_SIZE} />}
            title={t("authShellFeaturePhoneTitle")}
            body={t("authShellFeaturePhoneBody")}
          />
          <Feature
            icon={<LockIcon />}
            title={t("authShellFeatureCredsTitle")}
            body={t("authShellFeatureCredsBody")}
          />
        </ul>
      </div>
    </section>
  );
}
