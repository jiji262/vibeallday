import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/garden/Button";
import { EmptyState } from "../components/garden/EmptyState";
import { ErrorState } from "../components/garden/ErrorState";
import { Kbd } from "../components/garden/Kbd";
import { LoadingState } from "../components/garden/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { TriageCard } from "../components/triage/TriageCard";
import { TriageNext } from "../components/triage/TriageNext";
import styles from "../components/triage/TriagePage.module.css";
import { TriageProgress } from "../components/triage/TriageProgress";
import { triageSessionHref } from "../components/triage/triageItem";
import { useTriageQueue } from "../components/triage/useTriageQueue";
import { useTriageShortcuts } from "../components/triage/useTriageShortcuts";
import type { InboxItem } from "../contexts/InboxContext";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useSessionOverview } from "../hooks/useSessionOverview";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";

function scopeQuery(projectId: string | undefined): string {
  return projectId ? `?${new URLSearchParams({ project: projectId })}` : "";
}

/** Navigation for the page: leave to Inbox, or open an item and come back. */
function useTriageNavigation(projectId: string | undefined) {
  const basePath = useRemoteBasePath();
  const navigate = useNavigate();
  const location = useLocation();
  const here = `${location.pathname}${location.search}`;
  const inboxHref = `${basePath}/inbox${scopeQuery(projectId)}`;
  return {
    basePath,
    inboxHref,
    restored: location.state,
    exit: () => navigate(inboxHref),
    /** Keep progress on this history entry, then open the session. */
    open: (href: string, progress: unknown) => {
      navigate(here, { replace: true, state: { triage: progress } });
      navigate(href, { state: { triageReturnTo: here } });
    },
  };
}

function TriageDone({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t("inboxTriageDoneTitle")}
      hint={t("inboxTriageDoneHint")}
      action={
        <Button variant="primary" onClick={onExit}>
          {t("inboxTriageBackToInbox")}
        </Button>
      }
    />
  );
}

function ShortcutHints({ canSkip }: { canSkip: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={styles.hints}
      role="group"
      aria-label={t("inboxTriageShortcutsLabel")}
    >
      {canSkip && (
        <span>
          <Kbd>S</Kbd> {t("inboxTriageSkip")}
        </span>
      )}
      <span>
        <Kbd>Esc</Kbd> {t("inboxTriageKeyExit")}
      </span>
    </div>
  );
}

type TriageQueue = ReturnType<typeof useTriageQueue>;
type Overview = ReturnType<typeof useSessionOverview>;

interface TriageBodyProps {
  overview: Overview;
  queue: TriageQueue;
  hrefFor: (item: InboxItem) => string;
  onOpen: (item: InboxItem) => void;
  onExit: () => void;
}

/** Loading, error, done, or the current card with the items after it. */
function TriageBody({
  overview,
  queue,
  hrefFor,
  onOpen,
  onExit,
}: TriageBodyProps) {
  const { t } = useI18n();
  const [current, ...rest] = queue.order;
  if (overview.loading) {
    return <LoadingState label={t("inboxLoading")} variant="cards" />;
  }
  if (!current && overview.error) {
    return (
      <ErrorState
        tag={t("errorTag")}
        message={t("inboxError", { message: overview.error.message })}
        onRetry={() => void overview.refresh()}
        retryLabel={t("retry")}
      />
    );
  }
  // An incomplete catalog may still hold sessions that need the reader.
  if (!current && overview.partial) {
    return <LoadingState label={t("inboxLoading")} variant="cards" />;
  }
  if (!current) return <TriageDone onExit={onExit} />;
  return (
    <>
      <TriageCard
        item={current}
        href={hrefFor(current)}
        onOpen={onOpen}
        onSkip={queue.skipCurrent}
        canSkip={rest.length > 0}
      />
      <TriageNext
        items={rest}
        firstStep={queue.counts.current + 1}
        hrefFor={hrefFor}
        onOpen={onOpen}
      />
      <ShortcutHints canSkip={rest.length > 0} />
    </>
  );
}

function ExitButton({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  return (
    <Button size="sm" onClick={onExit} aria-keyshortcuts="Escape">
      {t("inboxTriageExit")}
      <span className={styles.kbd} aria-hidden="true">
        <Kbd>Esc</Kbd>
      </span>
    </Button>
  );
}

/**
 * One-by-one triage of needs-you sessions. The session summary says only
 * why an item waits, so each card opens the session to decide and the page
 * picks up the next item when the user comes back.
 */
export function TriagePage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen, tabBarNavigation } = useNavigationLayout();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project") ?? undefined;
  const overview = useSessionOverview(projectId);
  const nav = useTriageNavigation(projectId);
  const queue = useTriageQueue(overview.needsAttention, nav.restored);
  const hrefFor = (item: InboxItem) => triageSessionHref(nav.basePath, item);
  const open = (item: InboxItem) => nav.open(hrefFor(item), queue.progress);
  useTriageShortcuts({
    onSkip: queue.order.length > 1 ? queue.skipCurrent : undefined,
    onExit: nav.exit,
  });
  const title = t("inboxTriageTitle");
  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={title}
        intro="content"
        breadcrumbs={[
          { label: t("shellNavInbox"), to: nav.inboxHref },
          { label: title },
        ]}
        showBack={tabBarNavigation}
        onBack={nav.exit}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("narrow")}`}>
          <PageIntro
            title={title}
            actions={
              <div className={styles.topActions}>
                <TriageProgress counts={queue.counts} />
                <ExitButton onExit={nav.exit} />
              </div>
            }
          />
          <div className={styles.body}>
            <TriageBody
              overview={overview}
              queue={queue}
              hrefFor={hrefFor}
              onOpen={open}
              onExit={nav.exit}
            />
          </div>
        </div>
      </main>
    </MainContent>
  );
}
