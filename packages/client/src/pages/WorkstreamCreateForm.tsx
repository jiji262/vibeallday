import type { WorkstreamCheckoutPreviewResponse } from "@vibeallday/shared";
import type { FormEvent } from "react";
import { Button } from "../components/garden/Button";
import { Card, CardBody, CardFooter } from "../components/garden/Card";
import { inputClassName } from "../components/garden/Field";
import { Spinner } from "../components/garden/Spinner";
import type { useI18n } from "../i18n";
import styles from "./WorkstreamsPage.module.css";

type Translate = ReturnType<typeof useI18n>["t"];

export type WorkstreamsPreviewState =
  | { status: "idle" | "loading" }
  | { status: "loaded"; data: WorkstreamCheckoutPreviewResponse }
  | { status: "error"; error: Error; statusCode?: number };

const PREVIEW_SPINNER_SIZE = 12;

function DestinationPreview({
  previewState,
  t,
}: {
  previewState: WorkstreamsPreviewState;
  t: Translate;
}) {
  if (previewState.status === "loaded") {
    return (
      <code
        className={styles.previewPath}
        title={previewState.data.checkoutPath}
      >
        {previewState.data.checkoutPath}
      </code>
    );
  }
  if (previewState.status === "loading") {
    return (
      <span className={styles.previewNote}>
        <Spinner size={PREVIEW_SPINNER_SIZE} tone="muted" />
        {t("workstreamsDestinationLoading")}
      </span>
    );
  }
  if (previewState.status === "error") {
    return (
      <span className={styles.createError}>{previewState.error.message}</span>
    );
  }
  return (
    <span className={styles.previewNote}>
      {t("workstreamsDestinationPending")}
    </span>
  );
}

interface WorkstreamCreateFormProps {
  label: string;
  previewState: WorkstreamsPreviewState;
  creating: boolean;
  createError: string | null;
  canSubmit: boolean;
  onLabelChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  t: Translate;
}

/** Label field, live checkout destination preview, then Cancel and Create. */
export function WorkstreamCreateForm({
  label,
  previewState,
  creating,
  createError,
  canSubmit,
  onLabelChange,
  onCancel,
  onSubmit,
  t,
}: WorkstreamCreateFormProps) {
  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardBody className={styles.createBody}>
          <div className={styles.createField}>
            <label
              className={styles.fieldLabel}
              htmlFor="workstream-label-input"
            >
              {t("workstreamsLabelLabel")}
            </label>
            <input
              id="workstream-label-input"
              type="text"
              className={inputClassName()}
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
              placeholder={t("workstreamsLabelPlaceholder")}
              disabled={creating}
            />
          </div>
          <div className={styles.createPreview}>
            <span className={styles.fieldMeta}>
              {t("workstreamsDestinationLabel")}
            </span>
            <DestinationPreview previewState={previewState} t={t} />
          </div>
          {createError ? (
            <p className={styles.createError} role="alert">
              {createError}
            </p>
          ) : null}
        </CardBody>
        <CardFooter className={styles.createActions}>
          <Button variant="ghost" onClick={onCancel} disabled={creating}>
            {t("modalCancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {creating
              ? t("workstreamsCreatingAction")
              : t("workstreamsCreateAction")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
