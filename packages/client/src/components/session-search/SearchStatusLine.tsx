import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { Spinner } from "../garden/Spinner";
import styles from "./SearchToolbar.module.css";

/** Matches the 11px mono count it trails. */
const SCAN_SPINNER_SIZE = 12;

/**
 * "in 34 sessions" with a spinner while the catalog or a scan is still
 * arriving (a trailing "…" read as clipped text); tapping it reveals the
 * longer progress sentence (scanned / capped / watching).
 */
export function SearchStatusLine({
  status,
  sessionCount,
  scanning,
  acquiring,
}: {
  status?: string;
  sessionCount: number;
  scanning: boolean;
  acquiring: boolean;
}) {
  const { t } = useI18n();
  const area = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!status) setOpen(false);
  }, [status]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !area.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <span ref={area} className={styles.statusArea}>
      <button
        type="button"
        className={styles.statusButton}
        disabled={!status}
        title={status}
        aria-label={status || t("sessionSearchStatus")}
        aria-expanded={open}
        data-search-scanning={scanning}
        onClick={() => setOpen((value) => !value)}
      >
        <span data-search-scope>
          {t("sessionSearchScope", { count: sessionCount })}
        </span>
        <span
          className={styles.scanIndicator}
          style={{ visibility: acquiring ? "visible" : "hidden" }}
          aria-hidden="true"
        >
          <Spinner size={SCAN_SPINNER_SIZE} />
        </span>
      </button>
      {open && <span className={styles.statusDetails}>{status}</span>}
    </span>
  );
}
