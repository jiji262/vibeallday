import { useId } from "react";
import { useRecentComposerPrompts } from "../hooks/useRecentComposerPrompts";
import { useI18n } from "../i18n";
import { Card } from "./garden/Card";
import { ArrowUpIcon, ClockIcon } from "./garden/icons";
import { SessionListTime } from "./SessionListTime";
import styles from "./NewSessionRecentPrompts.module.css";

/** The design board lists three; older prompts stay in the history rail. */
const VISIBLE_PROMPTS = 3;
const ICON_SIZE = 16;

interface NewSessionRecentPromptsProps {
  /** Composer-history scope; null until the acting account is known. */
  scope: string | null;
  /** Put the prompt in the composer for editing; nothing starts. */
  onFill: (text: string) => void;
  className?: string;
}

/** Recent prompts under an empty composer: one tap fills, never sends. */
export function NewSessionRecentPrompts({
  scope,
  onFill,
  className,
}: NewSessionRecentPromptsProps) {
  const { t } = useI18n();
  const headingId = useId();
  const prompts = useRecentComposerPrompts(scope, VISIBLE_PROMPTS);
  if (prompts.length === 0) return null;
  return (
    <section
      className={className ? `${styles.section} ${className}` : styles.section}
      aria-labelledby={headingId}
    >
      <div className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          {t("newSessionRecentPromptsTitle")}
        </h2>
        <span className={styles.hint}>{t("newSessionRecentPromptsHint")}</span>
      </div>
      <Card flush className={styles.list}>
        {prompts.map((prompt) => (
          <button
            key={prompt.at}
            type="button"
            className={styles.row}
            onClick={() => onFill(prompt.text)}
          >
            <ClockIcon size={ICON_SIZE} className={styles.icon} />
            <span className={styles.body}>
              <span className={styles.prompt}>{prompt.text}</span>
              <span className={styles.meta}>
                <SessionListTime
                  timestamp={new Date(prompt.at).toISOString()}
                />
              </span>
            </span>
            <ArrowUpIcon size={ICON_SIZE} className={styles.icon} />
          </button>
        ))}
      </Card>
    </section>
  );
}
