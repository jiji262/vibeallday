import { useState } from "react";
import { useI18n } from "../../i18n";
import { Modal } from "../ui/Modal";
import styles from "./Onboarding.module.css";
import { RemoteAccessStep, ThemeStep } from "./steps";
import type { OnboardingStepConfig } from "./types";

/**
 * Extensible step registry - add new steps here.
 * The order in this array determines the wizard flow.
 */
const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: "theme",
    titleKey: "onboardingThemeTitle",
    component: ThemeStep,
  },
  {
    id: "remote-access",
    titleKey: "onboardingRemoteTitle",
    component: RemoteAccessStep,
  },
];

interface OnboardingWizardProps {
  /** Called when onboarding is complete (finished or skipped) */
  onComplete: () => void;
}

/**
 * Multi-step onboarding wizard shown on first launch.
 * Guides users through initial setup: theme selection and remote access info.
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { t } = useI18n();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = ONBOARDING_STEPS[currentStepIndex];

  // Guard against undefined (shouldn't happen in practice)
  if (!currentStep) {
    onComplete();
    return null;
  }

  const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1;
  const StepComponent = currentStep.component;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleSkipAll = () => {
    onComplete();
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const isFirstStep = currentStepIndex === 0;

  const modalTitle = (
    <div className={styles.modalTitle}>
      <span>{t("onboardingWelcomeTitle")}</span>
      <span className={styles.stepIndicator}>
        {t("onboardingStepCount", {
          step: currentStepIndex + 1,
          total: ONBOARDING_STEPS.length,
        })}
      </span>
    </div>
  );

  return (
    <Modal title={modalTitle} onClose={handleSkipAll} variant="dialog">
      {/* `onboarding-wizard` sizes the modal from styles/index.css. */}
      <div className={`onboarding-wizard ${styles.wizard}`}>
        <h2 className={styles.stepTitle}>{t(currentStep.titleKey)}</h2>

        <StepComponent
          onNext={handleNext}
          onSkip={handleSkip}
          isLastStep={isLastStep}
        />

        <div className={styles.footer}>
          <button
            type="button"
            className={`onboarding-skip-all ${styles.quietButton}`}
            onClick={handleSkipAll}
          >
            {t("onboardingSkipAll")}
          </button>
          <div className={styles.footerRight}>
            {!isFirstStep && (
              <button
                type="button"
                className={styles.quietButton}
                onClick={handleBack}
              >
                {t("onboardingBack")}
              </button>
            )}
            <div className={styles.progress} aria-hidden="true">
              {ONBOARDING_STEPS.map((step, index) => (
                <span
                  key={step.id}
                  className={
                    index <= currentStepIndex
                      ? `${styles.dot} ${styles.dotDone}`
                      : styles.dot
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
