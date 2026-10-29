import type {
  Workstream,
  WorkstreamKind,
  WorkstreamStatus,
} from "@vibeallday/shared";
import { Badge, type BadgeTone } from "../components/garden/Badge";
import { Card, CardHeader } from "../components/garden/Card";
import { Table, Td, Th, Tr } from "../components/garden/DataTable";
import { EmptyState } from "../components/garden/EmptyState";
import type { useI18n } from "../i18n";
import styles from "./WorkstreamsPage.module.css";

type Translate = ReturnType<typeof useI18n>["t"];

/** Explicit lookup: the status set is finite. */
const STATUS_TONE: Record<WorkstreamStatus, BadgeTone> = {
  active: "mint",
  archived: "outline",
  landed: "indigo",
};

function kindLabel(kind: WorkstreamKind, t: Translate) {
  switch (kind) {
    case "main":
      return t("workstreamsKindMain");
    case "checkout":
      return t("workstreamsKindCheckout");
  }
}

function statusLabel(status: WorkstreamStatus, t: Translate) {
  switch (status) {
    case "active":
      return t("workstreamsStatusActive");
    case "archived":
      return t("workstreamsStatusArchived");
    case "landed":
      return t("workstreamsStatusLanded");
  }
}

function WorkstreamsRow({
  workstream,
  t,
}: {
  workstream: Workstream;
  t: Translate;
}) {
  return (
    <Tr>
      <th scope="row" className={styles.laneCell}>
        {workstream.label}
      </th>
      <Td muted>{kindLabel(workstream.kind, t)}</Td>
      <Td mono>{workstream.branch ?? t("workstreamsValueNone")}</Td>
      <Td>
        {workstream.queuePaused ? (
          <Badge tone="peach">{t("workstreamsQueuePaused")}</Badge>
        ) : (
          <Badge tone="mint" dot>
            {t("workstreamsQueueRunning")}
          </Badge>
        )}
      </Td>
      <Td>
        <Badge tone={STATUS_TONE[workstream.status]}>
          {statusLabel(workstream.status, t)}
        </Badge>
      </Td>
      <Td muted aria-label={t("workstreamsSessionsUnavailable")}>
        <span aria-hidden="true">-</span>
      </Td>
      <Td mono className={styles.pathCell} title={workstream.path}>
        {workstream.path}
      </Td>
    </Tr>
  );
}

/**
 * The project's lanes as one flush card: serif title with a mono lane count,
 * the garden table (scrolls inside the card on narrow screens), and a
 * compact note when only the main checkout exists.
 */
export function WorkstreamsTable({
  workstreams,
  t,
}: {
  workstreams: Workstream[];
  t: Translate;
}) {
  if (workstreams.length === 0) {
    return (
      <EmptyState
        title={t("workstreamsEmptyTitle")}
        hint={t("workstreamsEmptyDescription")}
      />
    );
  }

  const checkoutCount = workstreams.filter(
    (workstream) => workstream.kind === "checkout",
  ).length;

  return (
    <Card flush as="section">
      <CardHeader
        title={t("workstreamsTableLabel")}
        meta={t("workstreamsLaneCount", { count: workstreams.length })}
      />
      <Table label={t("workstreamsTableLabel")}>
        <thead>
          <tr>
            <Th>{t("workstreamsColumnLane")}</Th>
            <Th>{t("workstreamsColumnKind")}</Th>
            <Th>{t("workstreamsColumnBranch")}</Th>
            <Th>{t("workstreamsColumnQueue")}</Th>
            <Th>{t("workstreamsColumnStatus")}</Th>
            <Th>{t("workstreamsColumnSessions")}</Th>
            <Th>{t("workstreamsColumnPath")}</Th>
          </tr>
        </thead>
        <tbody>
          {workstreams.map((workstream) => (
            <WorkstreamsRow key={workstream.id} workstream={workstream} t={t} />
          ))}
        </tbody>
      </Table>
      {checkoutCount === 0 ? (
        <EmptyState
          compact
          title={t("workstreamsNoCheckoutsTitle")}
          hint={t("workstreamsNoCheckoutsDescription")}
        />
      ) : null}
    </Card>
  );
}
