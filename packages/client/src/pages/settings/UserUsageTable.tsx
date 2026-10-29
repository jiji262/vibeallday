import {
  type UsageReport,
  type UsageTokenBucket,
  type UsageTotals,
  coveredCalendarDays,
  displayModelId,
  rawTokenCount,
} from "@vibeallday/shared";
import { useState } from "react";
import { SegmentedControl } from "../../components/controls/SegmentedControl";
import { Card } from "../../components/garden/Card";
import { Table, Td, Th, Tr } from "../../components/garden/DataTable";
import { useI18n } from "../../i18n";
import styles from "./UsersSettings.module.css";

/**
 * Per-principal usage for Settings → Users.
 *
 * Contract: topics/limited-users.md § Delivery v1 — Usage. One window at a
 * time, chosen by a switch: everything the ledger holds, or the last seven
 * days. The first names the calendar days it spans, because the ledger starts
 * the day the feature lands rather than covering the install's whole history.
 * The second says "7 days" rather than "last week", which a reader otherwise
 * takes for the last whole calendar week. Totals are one table with a row per
 * user; each user's tokens break down by model and by project in tables of
 * their own, so figures line up in columns instead of running together.
 */

export interface UserUsageTableProps {
  report: UsageReport;
}

type UsageWindow = "total" | "lastWeek";
const USAGE_WINDOWS: readonly UsageWindow[] = ["total", "lastWeek"];
type Translate = (key: never, vars?: Record<string, string | number>) => string;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/** A cell with no figure: the model has no price, or nothing was charged. */
const NO_FIGURE = "—";

/** Interaction time as a short phrase: "3h 20m", "45m", "under a minute". */
export function formatActiveTime(ms: number, t: Translate): string {
  if (ms <= 0) return t("userUsageNone" as never);
  const hours = Math.floor(ms / HOUR_MS);
  const minutes = Math.round((ms % HOUR_MS) / MINUTE_MS);
  if (hours > 0) {
    return minutes > 0
      ? t("userUsageHoursMinutes" as never, { hours, minutes })
      : t("userUsageHours" as never, { hours });
  }
  if (minutes > 0) return t("userUsageMinutes" as never, { minutes });
  return t("userUsageUnderAMinute" as never);
}

/**
 * A token count for a table cell: exact under ten thousand, then thousands or
 * millions to one decimal, because the comparison between rows is the point
 * and nine significant digits of it do not help.
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 10_000) return tokens.toLocaleString();
  if (tokens < 1_000_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

/** Dollars at a precision that still distinguishes two cheap sessions. */
export function formatUsd(usd: number): string {
  if (usd > 0 && usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(usd < 10 ? 2 : 0)}`;
}

export function UserUsageTable({ report }: UserUsageTableProps) {
  const { t } = useI18n();
  const [usageWindow, setUsageWindow] = useState<UsageWindow>("total");
  const days = coveredCalendarDays(report.since, report.now);
  // A principal with nothing recorded in either window is noise in the table.
  const rows = report.users.filter(
    (user) => user.total.turns > 0 || user.total.sessions > 0,
  );
  const windowLabels: Record<UsageWindow, string> = {
    total:
      days === 1
        ? t("userUsageAllRecordedDay")
        : t("userUsageAllRecordedDays", { days }),
    lastWeek: t("userUsageLastSevenDays"),
  };

  return (
    <div className={styles.usage}>
      <h3 className={styles.editorTitle}>{t("userUsageTitle")}</h3>
      <p className="settings-hint">
        {report.since === null
          ? t("userUsageEmpty")
          : days === 1
            ? t("userUsageSinceDay")
            : t("userUsageSinceDays", { days })}
      </p>
      {rows.length > 0 && (
        <>
          <SegmentedControl
            label={t("userUsageWindowLabel")}
            options={USAGE_WINDOWS.map((key) => ({
              value: key,
              label: windowLabels[key],
            }))}
            value={usageWindow}
            onChange={setUsageWindow}
            className={styles.usageWindow}
          />
          <Card flush className={styles.usageCard}>
            <Table>
              {/* The switch above already shows the window; this names the
                  table for assistive technology. */}
              <caption className={styles.usageWindowLegend}>
                {windowLabels[usageWindow]}
              </caption>
              <thead>
                <tr>
                  <Th>{t("userUsageUser")}</Th>
                  <Th right>{t("userUsageColTime")}</Th>
                  <Th right>{t("userUsageColSessions")}</Th>
                  <Th right>{t("userUsageColTurns")}</Th>
                  <Th right>{t("userUsageColWords")}</Th>
                  <Th right>{t("userUsageColTokens")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const totals = user[usageWindow];
                  const raw = rawTokenCount(totals.tokens);
                  return (
                    <Tr key={user.username ?? ""}>
                      <th scope="row" className={styles.usageUser}>
                        {user.username ?? t("usersSuperuser")}
                      </th>
                      <Td num right>
                        {formatActiveTime(totals.activeMs, t)}
                      </Td>
                      <Td num right>
                        {totals.sessions.toLocaleString()}
                      </Td>
                      <Td num right>
                        {totals.turns.toLocaleString()}
                      </Td>
                      <Td num right>
                        {totals.words.toLocaleString()}
                      </Td>
                      <Td
                        num
                        right
                        title={
                          raw > 0
                            ? t(
                                "userUsageTokenSplit",
                                classSplit(totals.tokens),
                              )
                            : undefined
                        }
                      >
                        {raw > 0 ? formatTokenCount(raw) : NO_FIGURE}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
          {rows.map((user) => {
            const name = user.username ?? t("usersSuperuser");
            const totals = user[usageWindow];
            return (
              <div key={user.username ?? ""}>
                <UsageBreakdownTable
                  title={t("userUsageByModelTitle", { user: name })}
                  nameHeading={t("userUsageColModel")}
                  buckets={totals.byModel}
                  displayName={displayModelId}
                />
                <UsageBreakdownTable
                  title={t("userUsageByProjectTitle", { user: name })}
                  nameHeading={t("userUsageColProject")}
                  buckets={totals.byProject}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/** The four counts, for the hover that explains the volume figure. */
function classSplit(tokens: UsageTotals["tokens"]) {
  return {
    fresh: tokens.freshInputTokens.toLocaleString(),
    cached: tokens.cachedInputTokens.toLocaleString(),
    written: tokens.cacheWriteTokens.toLocaleString(),
    output: tokens.outputTokens.toLocaleString(),
  };
}

/**
 * One user's tokens split by model or by project, costliest first as the
 * report orders them. The output-token equivalent stays meaningful when a
 * price changes; dollars are an estimate and absent for an unlisted model;
 * volume is always known. The two splits are separate tables rather than a
 * model-by-project grid, which nobody asked to read.
 */
function UsageBreakdownTable({
  title,
  nameHeading,
  buckets,
  displayName = (name) => name,
}: {
  title: string;
  nameHeading: string;
  buckets: UsageTokenBucket[];
  /** How a bucket's name reads; model ids drop their vendor name. */
  displayName?: (name: string) => string;
}) {
  const { t } = useI18n();
  const named = buckets.filter((bucket) => rawTokenCount(bucket.tokens) > 0);
  if (named.length === 0) return null;
  return (
    <Card flush className={styles.usageCard}>
      <Table>
        <caption className={styles.usageCaption}>{title}</caption>
        <thead>
          <tr>
            <Th>{nameHeading}</Th>
            <Th right>{t("userUsageColOutputEquivalent")}</Th>
            <Th right>{t("userUsageColCost")}</Th>
            <Th right>{t("userUsageColVolume")}</Th>
          </tr>
        </thead>
        <tbody>
          {named.map((bucket) => (
            <Tr key={bucket.name}>
              <th scope="row" className={styles.usageUser}>
                {bucket.name
                  ? displayName(bucket.name)
                  : t("userUsageUnattributed")}
              </th>
              <Td num right>
                {bucket.equivalentOutputTokens === null
                  ? NO_FIGURE
                  : formatTokenCount(bucket.equivalentOutputTokens)}
              </Td>
              <Td num right>
                {bucket.costUsd === null
                  ? NO_FIGURE
                  : formatUsd(bucket.costUsd)}
              </Td>
              <Td num right>
                {formatTokenCount(rawTokenCount(bucket.tokens))}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
