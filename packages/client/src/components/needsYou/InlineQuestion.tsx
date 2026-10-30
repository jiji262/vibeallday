import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { makeSecurityVisibleText } from "../../lib/securityVisibleText";
import styles from "./NeedsYouInline.module.css";
import { type InlineAsk, quickAnswer } from "./pendingInputModel";
import type { InputResponse, RespondOptions } from "./usePendingInput";

type QuestionAsk = Extract<InlineAsk, { kind: "question" }>;

export interface InlineQuestionProps {
  ask: QuestionAsk;
  armed: boolean;
  submitting: boolean;
  onRespond: (
    response: InputResponse,
    options?: RespondOptions,
  ) => Promise<boolean>;
  /** Writing a custom answer happens in the session's question panel. */
  sessionHref: string;
  onOpenSession?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

const PENCIL_SIZE = 12;

function PencilIcon() {
  return (
    <svg
      width={PENCIL_SIZE}
      height={PENCIL_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}

/** A single-choice question answered with one tap on an option. */
export function InlineQuestion(props: InlineQuestionProps) {
  const { t } = useI18n();
  const { ask, armed, submitting, onRespond } = props;
  const { question } = ask;
  const disabled = !armed || submitting;
  return (
    <div className={styles.root}>
      <p className={styles.question}>
        {makeSecurityVisibleText(question.question)}
      </p>
      <div
        className={styles.chips}
        role="group"
        aria-label={t("needsYouAnswerOptions")}
      >
        {question.options.map((option) => (
          <button
            key={option.label}
            type="button"
            className={styles.chip}
            title={option.description || undefined}
            disabled={disabled}
            onClick={() =>
              void onRespond("approve", {
                answers: quickAnswer(question, option.label),
              })
            }
          >
            {makeSecurityVisibleText(option.label)}
          </button>
        ))}
        <Link
          to={props.sessionHref}
          className={`${styles.chip} ${styles.chipQuiet}`}
          onClick={props.onOpenSession}
        >
          <PencilIcon />
          {t("needsYouWriteOwnAnswer")}
        </Link>
      </div>
    </div>
  );
}

/** What waits when the card cannot answer it in place. */
export function InSessionNote({ ask }: { ask: InlineAsk }) {
  const { t } = useI18n();
  if (ask.kind === "plan") {
    return <p className={styles.note}>{t("needsYouPlanInSession")}</p>;
  }
  if (ask.kind !== "questionInSession") return null;
  return (
    <div className={styles.root}>
      {ask.question && (
        <p className={styles.question}>
          {makeSecurityVisibleText(ask.question.question)}
        </p>
      )}
      <p className={styles.note}>{t("needsYouAnswerInSession")}</p>
    </div>
  );
}
