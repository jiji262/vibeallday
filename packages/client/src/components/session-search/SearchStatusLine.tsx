import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import styles from "./SearchToolbar.module.css";

/**
 * "in 34 sessions" with a scanning ellipsis; tapping it reveals the longer
 * progress sentence (scanned / capped / watching).
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
  const area = useRef<HTMLDivElement>(null);
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
    <div ref={area} className={styles.statusArea}>
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
          …
        </span>
      </button>
      {open && <div className={styles.statusDetails}>{status}</div>}
    </div>
  );
}
