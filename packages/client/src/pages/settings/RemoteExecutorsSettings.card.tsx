import type { RemoteExecutorTestResult } from "../../api/client";
import { Badge, type BadgeTone } from "../../components/garden/Badge";
import { useI18n } from "../../i18n";
import styles from "./RemoteExecutorsSettings.module.css";

interface ExecutorCardProps {
  host: string;
  testing: boolean;
  result: RemoteExecutorTestResult | undefined;
  onTest: () => void;
  onRemove: () => void;
}

type CardState = "ok" | "err" | "idle";

const STATE_TONE: Record<CardState, BadgeTone> = {
  ok: "ok",
  err: "err",
  idle: "idle",
};

function cardState(result: RemoteExecutorTestResult | undefined): CardState {
  if (!result) return "idle";
  return result.success ? "ok" : "err";
}

function useCliText(result: RemoteExecutorTestResult | undefined): string {
  const { t } = useI18n();
  if (!result?.success) return t("settingsRemoteExecutorCliUnknown");
  if (!result.claudeAvailable) return t("remoteExecutorsClaudeMissing");
  return result.claudeVersion
    ? t("remoteExecutorsClaudeVersion", { version: result.claudeVersion })
    : t("remoteExecutorsClaudeAvailable");
}

/**
 * One configured SSH host as a device card (design S-RemoteExecutors):
 * status mark, host, the last test's status and remote CLI result. Only the
 * fields the test endpoint reports are shown.
 */
export function ExecutorCard({
  host,
  testing,
  result,
  onTest,
  onRemove,
}: ExecutorCardProps) {
  const { t } = useI18n();
  const state = cardState(result);
  const cliText = useCliText(result);
  const statusLabel =
    state === "ok"
      ? t("remoteExecutorsConnected")
      : state === "err"
        ? t("remoteExecutorsFailed")
        : t("settingsRemoteExecutorUntested");
  return (
    <article className={styles.item} data-executor-state={state}>
      <div className={styles.itemHead}>
        <span className={styles.mark} aria-hidden="true" />
        <div className={styles.itemInfo}>
          <span className={styles.host}>{host}</span>
          <span className={styles.sshLine}>ssh {host}</span>
        </div>
        <Badge tone={STATE_TONE[state]} dot>
          {statusLabel}
        </Badge>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className={styles.testButton}
          >
            {testing
              ? t("remoteExecutorsTesting")
              : t("remoteExecutorsTestConnection")}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeButton}
          >
            {t("remoteExecutorsRemove")}
          </button>
        </div>
      </div>
      {result && !result.success && (
        <p className={`settings-error ${styles.error}`}>{result.error}</p>
      )}
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t("settingsRemoteExecutorCliFact")}</dt>
          <dd className={styles.details}>{cliText}</dd>
        </div>
      </dl>
    </article>
  );
}
