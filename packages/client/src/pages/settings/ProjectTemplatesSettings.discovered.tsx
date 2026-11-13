import type { ProjectTemplateSourceState } from "@vibeallday/shared";
import { Status, type StatusState } from "../../components/garden/StatusDot";
import { useI18n } from "../../i18n";
import styles from "./ProjectTemplatesSettings.module.css";

const GITHUB_PREFIX = "https://github.com/";

function shortRepository(repository: string | undefined): string {
  return repository?.replace(GITHUB_PREFIX, "") ?? "";
}

/** Fetch state as one design status pill, or null before anything loads. */
function PhaseStatus({ state }: { state: ProjectTemplateSourceState | null }) {
  const { t } = useI18n();
  if (!state) return null;
  let tone: StatusState = "idle";
  let text: string | null = null;
  if (state.phase === "fetching") {
    tone = "run";
    text = t("templatesFetching");
  } else if (state.phase === "disabled") {
    text = t("templatesDisabled");
  } else if (state.phase === "ready") {
    tone = "ok";
    text =
      state.result === "up-to-date"
        ? t("templatesUpToDate")
        : t("templatesFetched");
  }
  if (!text) return null;
  return (
    <Status state={tone} plain>
      {text}
    </Status>
  );
}

/** Live fetch state; the status line the settings header card shows. */
export function TemplatesFetchStatus({
  state,
}: {
  state: ProjectTemplateSourceState | null;
}) {
  return (
    <div className={styles.status} role="status">
      <PhaseStatus state={state} />
    </div>
  );
}

/**
 * What the last fetch found: each source's resolved commit and the template
 * cards. Usage counts are not recorded, so the cards omit them.
 */
export function DiscoveredTemplates({
  state,
}: {
  state: ProjectTemplateSourceState | null;
}) {
  const { t } = useI18n();
  const snapshot = state?.snapshot;
  if (!snapshot) return null;
  return (
    <section className={styles.discovered}>
      <h3 className={styles.sectionTitle}>{t("templatesSectionDiscovered")}</h3>
      <div className={`settings-group ${styles.snapshotSources}`}>
        {snapshot.sources.map((source) => (
          <div key={source.id} className={styles.snapshotSource}>
            <p>
              {shortRepository(source.repository)}
              {source.commit && (
                <>
                  {" — "}
                  {t(source.local ? "templatesLocalHead" : "templatesCommit")}{" "}
                  <code>{source.commit}</code>
                </>
              )}
            </p>
            <p className={styles.meta}>
              {source.local
                ? t("templatesLocalDirect")
                : t("templatesRewritten", { count: source.rewrittenFiles })}
            </p>
          </div>
        ))}
      </div>
      <ul className={styles.templateGrid}>
        {snapshot.templates.map((template) => (
          <li key={template.id} className={styles.templateCard}>
            <div className={styles.templateHead}>
              <strong>{template.title}</strong>
              <Status state={template.status === "draft" ? "idle" : "ok"}>
                {template.status === "draft"
                  ? t("templatesDraft")
                  : t("templatesReady")}
              </Status>
            </div>
            <p>{template.description}</p>
            <span className={styles.meta}>
              {shortRepository(
                snapshot.sources.find(
                  (source) => source.id === template.sourceId,
                )?.repository,
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
