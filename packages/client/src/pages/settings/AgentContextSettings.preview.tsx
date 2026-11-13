import {
  LATEX_MATH_RENDERING_CLIENT_CAPABILITY,
  buildEffectiveAgentContext,
} from "@vibeallday/shared";
import { memo, useMemo } from "react";
import { Tag } from "../../components/garden/Badge";
import { useI18n } from "../../i18n";
import styles from "./AgentContextSettings.module.css";

interface EffectiveContextPreviewProps {
  /** Deferred editor text, so typing never waits on this render. */
  instructions: string;
  savedInstructions: string;
  latexMathRendering: boolean;
}

/**
 * The context blocks this client knows it sends: the global instructions
 * and the opt-in client capability hint. Provider-side placement and
 * per-session blocks are not known here, so they are not shown.
 */
export const EffectiveContextPreview = memo(function EffectiveContextPreview({
  instructions,
  savedInstructions,
  latexMathRendering,
}: EffectiveContextPreviewProps) {
  const { t } = useI18n();
  const effective = useMemo(
    () =>
      buildEffectiveAgentContext({
        globalInstructions: instructions,
        hints: { latexMathRendering },
      }),
    [instructions, latexMathRendering],
  );
  const trimmed = instructions.trim();
  return (
    <aside
      className={styles.preview}
      aria-labelledby="agent-context-effective-title"
    >
      <div className={styles.previewHead}>
        <h2 id="agent-context-effective-title">
          {t("settingsAgentContextEffectiveTitle")}
        </h2>
        <span className={styles.meta}>
          {t("settingsAgentContextEffectiveIncludesUnsaved")}
        </span>
      </div>
      <div className={styles.block} data-agent-context-block="instructions">
        <div className={styles.blockHead}>
          <strong>{t("agentContextGlobalInstructions")}</strong>
          <span className={styles.meta}>
            {t("settingsAgentContextBlockChars", {
              count: instructions.length.toLocaleString(),
            })}
          </span>
          {instructions !== savedInstructions && (
            <Tag tone="attn">{t("settingsAgentContextUnsavedTag")}</Tag>
          )}
        </div>
        {trimmed ? (
          <pre className={styles.blockPre}>{trimmed}</pre>
        ) : (
          <p className={styles.meta}>
            {t("settingsAgentContextNoInstructions")}
          </p>
        )}
      </div>
      <div className={styles.block} data-agent-context-block="client-hints">
        <div className={styles.blockHead}>
          <strong>{t("agentContextSuggestedLatexPreviewTitle")}</strong>
          <Tag tone={latexMathRendering ? "accent" : "idle"}>
            {latexMathRendering
              ? t("settingsAgentContextLatexOnTag")
              : t("settingsAgentContextLatexOffTag")}
          </Tag>
        </div>
        <pre className={styles.blockPre}>
          {`[Client capabilities]\n${LATEX_MATH_RENDERING_CLIENT_CAPABILITY}`}
        </pre>
        <p className={styles.meta}>
          {t("agentContextSuggestedLatexPreviewDescription")}
        </p>
      </div>
      <details className={styles.block}>
        <summary className={styles.meta}>
          {t("agentContextPreviewSummary")}
        </summary>
        <pre className={styles.fullPre}>
          {effective ?? t("agentContextPreviewEmpty")}
        </pre>
      </details>
    </aside>
  );
});
