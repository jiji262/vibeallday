import { THEMES, useTheme } from "../../../hooks/useTheme";
import { useI18n } from "../../../i18n";
import { getThemeLabel } from "../../../i18n-settings";
import { Button } from "../../garden/Button";
import styles from "../Onboarding.module.css";
import type { OnboardingStepProps } from "../types";

/**
 * Onboarding step for selecting a theme.
 * Shows visual previews of each theme option.
 */
export function ThemeStep({ onNext, onSkip, isLastStep }: OnboardingStepProps) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.stepContent}>
      <p className={styles.description}>{t("onboardingThemeDescription")}</p>

      <div className={styles.themeGrid}>
        {THEMES.map((themeName) => (
          <button
            key={themeName}
            type="button"
            className={
              theme === themeName
                ? `${styles.themeOption} ${styles.selected}`
                : styles.themeOption
            }
            aria-pressed={theme === themeName}
            onClick={() => setTheme(themeName)}
          >
            {/* Fixed preview swatches live in styles/index.css. */}
            <div
              className={`${styles.themePreview} theme-preview-${themeName}`}
            />
            <span className={styles.themeLabel}>
              {getThemeLabel(themeName, t)}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onSkip}>
          {t("onboardingSkip")}
        </Button>
        <Button variant="primary" onClick={onNext}>
          {t(isLastStep ? "onboardingFinish" : "onboardingNext")}
        </Button>
      </div>
    </div>
  );
}
