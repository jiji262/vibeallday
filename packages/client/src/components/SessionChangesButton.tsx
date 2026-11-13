import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { Button } from "./garden/Button";
import { DiffIcon } from "./garden/icons";

/**
 * Source Control's changes view for a session's project. `from=session`
 * keeps the phone tab bar on Sessions, so the reader is still "in" the
 * session while reviewing its changes.
 */
export function sessionChangesHref(basePath: string, projectId: string) {
  const params = new URLSearchParams({ projectId, from: "session" });
  return `${basePath}/git-status?${params.toString()}`;
}

/** Header shortcut to the project's changes, beside the session actions. */
export function SessionChangesButton({
  basePath,
  projectId,
  className,
}: {
  basePath: string;
  projectId: string;
  className?: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      icon={<DiffIcon />}
      className={className}
      title={t("sessionHeaderChangesHint")}
      onClick={() => navigate(sessionChangesHref(basePath, projectId))}
    >
      {t("sessionHeaderChanges")}
    </Button>
  );
}
