import { Fragment, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { Kbd } from "./garden/Kbd";
import styles from "./NewSessionHintLine.module.css";

interface NewSessionHintLineProps {
  /** Fine pointers start with Enter; touch keyboards insert a newline. */
  keyHints: boolean;
  /** Ctrl+Enter queues the prompt while the project queue is offered. */
  queueShortcut: boolean;
  /** Labels of the advanced options that differ from standard. */
  advanced: readonly string[];
  className?: string;
}

/** Design hint line under the chips: real shortcuts, then active options. */
export function NewSessionHintLine({
  keyHints,
  queueShortcut,
  advanced,
  className,
}: NewSessionHintLineProps) {
  const { t } = useI18n();
  const parts: Array<{ key: string; content: ReactNode }> = [];
  if (keyHints) {
    parts.push({
      key: "start",
      content: (
        <>
          <Kbd>Enter</Kbd> {t("newSessionStartLabel")}
        </>
      ),
    });
    if (queueShortcut) {
      parts.push({
        key: "queue",
        content: (
          <>
            <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> {t("toolbarProjectQueueLabel")}
          </>
        ),
      });
    }
  } else {
    parts.push({ key: "carry", content: t("newSessionHintCarryOver") });
  }
  if (advanced.length > 0) {
    parts.push({
      key: "advanced",
      content: t("newSessionHintAdvanced", {
        options: advanced.join(t("newSessionHintListSeparator")),
      }),
    });
  }
  return (
    <p
      className={className ? `${styles.line} ${className}` : styles.line}
      data-new-session-hint-line="true"
    >
      {parts.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 && " · "}
          {part.content}
        </Fragment>
      ))}
    </p>
  );
}

/** Design toolbar hints: @ opens file completion, / starts a command. */
export function NewSessionComposerHints() {
  const { t } = useI18n();
  return (
    <span className={styles.toolbarHints}>
      <span className={styles.toolbarHint}>
        <Kbd>@</Kbd>
        {t("newSessionHintMention")}
      </span>
      <span className={styles.toolbarHint}>
        <Kbd>/</Kbd>
        {t("newSessionHintCommand")}
      </span>
    </span>
  );
}
