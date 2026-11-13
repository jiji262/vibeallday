import { useNavigate } from "react-router-dom";
import { useRemoteBasePath } from "../../../hooks/useRemoteBasePath";
import { useI18n } from "../../../i18n";
import { Button } from "../../garden/Button";
import styles from "../Onboarding.module.css";
import type { OnboardingStepProps } from "../types";

/**
 * Onboarding step explaining remote access.
 * Provides info and option to configure remote access in settings.
 */
export function RemoteAccessStep({
  onNext,
  onSkip,
  isLastStep,
}: OnboardingStepProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const basePath = useRemoteBasePath();

  const handleGoToSettings = () => {
    onNext(); // Complete onboarding first
    navigate(`${basePath}/settings/remote`);
  };

  return (
    <div className={styles.stepContent}>
      <p className={styles.description}>{t("onboardingRemoteDescription")}</p>

      <div className={styles.infoBox}>
        <h4 className={styles.infoTitle}>
          {t("onboardingRemoteRequirementsTitle")}
        </h4>
        <ul className={styles.infoList}>
          <li>{t("onboardingRemoteRequirementRelayUrl")}</li>
          <li>{t("onboardingRemoteRequirementUsername")}</li>
          <li>{t("onboardingRemoteRequirementPassword")}</li>
        </ul>
      </div>

      <p className={styles.hint}>{t("onboardingRemoteHint")}</p>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onSkip}>
          {t(isLastStep ? "onboardingSkipFinish" : "onboardingSkip")}
        </Button>
        <Button variant="primary" onClick={handleGoToSettings}>
          {t("onboardingRemoteSetUp")}
        </Button>
      </div>
    </div>
  );
}
