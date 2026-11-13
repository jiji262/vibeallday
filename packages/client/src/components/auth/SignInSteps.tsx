import type { ReactNode } from "react";
import { CheckIcon } from "../garden/icons";
import styles from "./SignInSteps.module.css";

export type SignInStepState = "done" | "current" | "todo";

export interface SignInStep {
  key: string;
  title: string;
  state: SignInStepState;
  children?: ReactNode;
}

const CHECK_SIZE = 14;

const STATE_CLASS: Record<SignInStepState, string | undefined> = {
  done: styles.done,
  current: styles.current,
  todo: styles.todo,
};

/**
 * Vertical stepper (design auth/ProviderSignIn): numbered circles joined by
 * a rail; the current step's body sits in an accent-outlined panel.
 */
export function SignInSteps({
  label,
  steps,
}: {
  label: string;
  steps: readonly SignInStep[];
}) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {steps.map((step, index) => (
        <li
          key={step.key}
          className={`${styles.step} ${STATE_CLASS[step.state] ?? ""}`}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span className={styles.number} aria-hidden="true">
            {step.state === "done" ? (
              <CheckIcon size={CHECK_SIZE} />
            ) : (
              index + 1
            )}
          </span>
          <div className={styles.body}>
            <h3 className={styles.title}>{step.title}</h3>
            {step.children}
          </div>
        </li>
      ))}
    </ol>
  );
}
