import type { ProviderLoginFlow, ProviderName } from "@vibeallday/shared";
import { useI18n } from "../../i18n";
import styles from "./ProviderSignInFlow.module.css";
import {
  type SignInStep,
  type SignInStepState,
  SignInSteps,
} from "./SignInSteps";

/** Steps: 0 open the link, 1 paste the code (or finish in the browser), 2 done. */
const STEP_OPEN = 0;
const STEP_CODE = 1;
const STEP_DONE = 2;

interface ProviderSignInFlowProps {
  flow: ProviderLoginFlow;
  provider: ProviderName;
  displayName: string;
  problem: string | null;
  busy: boolean;
  code: string;
  onCodeChange: (code: string) => void;
  onSubmitCode: () => void;
  onCancel: () => void;
  onCopyUserCode: (userCode: string) => void;
}

function currentStep(flow: ProviderLoginFlow): number {
  if (!flow.url) return STEP_OPEN;
  return flow.codeSubmitted ? STEP_DONE : STEP_CODE;
}

function OpenLinkStep({
  flow,
  displayName,
  onCopyUserCode,
}: Pick<ProviderSignInFlowProps, "flow" | "displayName" | "onCopyUserCode">) {
  const { t } = useI18n();
  const userCode = flow.userCode;
  return (
    <>
      {flow.url ? (
        <a
          className="settings-button settings-button-primary"
          href={flow.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("providersSignInOpenPage", { provider: displayName })}
        </a>
      ) : (
        <p className="settings-hint">{t("providersSignInStarting")}</p>
      )}
      {userCode && (
        <div className={styles.row}>
          <span className="settings-hint">{t("providersSignInEnterCode")}</span>
          <code className={styles.userCode}>{userCode}</code>
          <button
            type="button"
            className="settings-button"
            onClick={() => onCopyUserCode(userCode)}
          >
            {t("providersSignInCopyCode")}
          </button>
        </div>
      )}
    </>
  );
}

function PasteCodeStep({
  busy,
  code,
  onCodeChange,
  onSubmitCode,
}: Pick<
  ProviderSignInFlowProps,
  "busy" | "code" | "onCodeChange" | "onSubmitCode"
>) {
  const { t } = useI18n();
  return (
    <>
      <p className="settings-hint">{t("providersSignInCodeHint")}</p>
      <form
        className={`${styles.row} ${styles.codeRow}`}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitCode();
        }}
      >
        <input
          type="text"
          className={styles.codeInput}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder={t("providersSignInCodePlaceholder")}
          aria-label={t("providersSignInCodePlaceholder")}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="settings-button settings-button-primary"
          disabled={busy || !code.trim()}
        >
          {t("providersSignInSubmitCode")}
        </button>
      </form>
    </>
  );
}

/** The three steps, with their state and body for this flow snapshot. */
function useFlowSteps(props: ProviderSignInFlowProps): SignInStep[] {
  const { flow, displayName } = props;
  const { t } = useI18n();
  const current = currentStep(flow);
  const stateOf = (index: number): SignInStepState =>
    index < current ? "done" : index === current ? "current" : "todo";
  const awaitingCode = flow.acceptsCode && !!flow.url && !flow.codeSubmitted;
  return [
    {
      key: "open",
      title: t("providerSignInStepOpen"),
      state: stateOf(STEP_OPEN),
      children: <OpenLinkStep {...props} />,
    },
    {
      key: "code",
      title: flow.acceptsCode
        ? t("providerSignInStepPaste")
        : t("providerSignInStepBrowser"),
      state: stateOf(STEP_CODE),
      children: awaitingCode ? <PasteCodeStep {...props} /> : null,
    },
    {
      key: "done",
      title: t("providerSignInStepDone"),
      state: stateOf(STEP_DONE),
      children: (
        <p className="settings-hint">
          {flow.codeSubmitted
            ? t("providersSignInVerifying")
            : t("providerSignInStepDoneHint", { provider: displayName })}
        </p>
      ),
    },
  ];
}

/**
 * A running provider sign-in as a stepper (design auth/ProviderSignIn):
 * open link → paste code → done, then the CLI output and Cancel. Shared by
 * the focused sign-in page and the provider row in Settings.
 */
export function ProviderSignInFlow(props: ProviderSignInFlowProps) {
  const { flow, provider, problem, busy, onCancel } = props;
  const { t } = useI18n();
  const steps = useFlowSteps(props);
  return (
    <div className={styles.panel} data-testid={`provider-sign-in-${provider}`}>
      {problem && (
        <p role="alert" className="settings-warning">
          {problem}
        </p>
      )}
      <SignInSteps label={t("providerSignInStepsLabel")} steps={steps} />
      {flow.output && (
        <pre
          role="region"
          className={styles.output}
          aria-label={t("providerSignInOutput")}
        >
          {flow.output}
        </pre>
      )}
      <div className={styles.row}>
        <button
          type="button"
          className="settings-button"
          onClick={onCancel}
          disabled={busy}
        >
          {t("providersSignInCancel")}
        </button>
      </div>
    </div>
  );
}
