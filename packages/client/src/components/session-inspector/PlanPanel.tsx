import { useI18n } from "../../i18n";
import { EmptyState, StatusDot, type StatusState } from "../garden";
import type { PlanSnapshot, PlanStepState } from "./inspectorPlan";
import styles from "./SessionInspector.module.css";

const STEP_STATUS: Record<PlanStepState, StatusState> = {
  completed: "ok",
  in_progress: "run",
  pending: "idle",
};

const STEP_CLASS: Record<PlanStepState, string | undefined> = {
  completed: styles.stepDone,
  in_progress: styles.stepActive,
  pending: undefined,
};

/** The latest TodoWrite / UpdatePlan list, read-only. */
export function PlanPanel({ plan }: { plan: PlanSnapshot | null }) {
  const { t } = useI18n();
  if (!plan || plan.steps.length === 0) {
    return (
      <div className={styles.panelBody}>
        <EmptyState
          compact
          title={t("sessionInspectorPlanEmpty")}
          hint={t("sessionInspectorPlanEmptyHint")}
        />
      </div>
    );
  }
  const done = plan.steps.filter((step) => step.state === "completed").length;
  return (
    <div className={styles.panelBody}>
      <div className={styles.summary}>
        <span className={`${styles.meta} ${styles.push}`}>
          {t("sessionInspectorPlanProgress", {
            done,
            total: plan.steps.length,
          })}
        </span>
      </div>
      <ol className={styles.list}>
        {plan.steps.map((step, index) => (
          <li
            // Steps carry no ids; the position is the provider's own order.
            key={index}
            className={`${styles.step} ${STEP_CLASS[step.state] ?? ""}`}
          >
            <StatusDot state={STEP_STATUS[step.state]} />
            <span className={styles.stepText}>
              <span>{step.text}</span>
              {step.state === "in_progress" && (
                <span className={styles.runText}>
                  {t("sessionInspectorPlanInProgress")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
