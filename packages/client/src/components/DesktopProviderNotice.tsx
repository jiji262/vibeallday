import type { ProviderInfo } from "@vibeallday/shared";
import { useEffect, useState } from "react";
import { useProviders } from "../hooks/useProviders";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import styles from "./DesktopProviderNotice.module.css";
import { XIcon } from "./garden/icons";

const CLAUDE_DOWNLOAD_URL = "https://claude.com/download";
const CODEX_DOWNLOAD_URL = "https://openai.com/codex/get-started/";
const DISMISS_ICON_SIZE = 16;
const DISMISSED_STORAGE_KEY = "desktop-provider-notice-dismissed";

export function readDesktopProviderNoticeDismissed(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): boolean {
  try {
    return storage.getItem(DISMISSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeDesktopProviderNoticeDismissed(
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  try {
    storage.setItem(DISMISSED_STORAGE_KEY, "true");
  } catch {
    // A storage failure leaves the current in-memory dismissal in place.
  }
}

export function hasDesktopProviderRuntime(providers: ProviderInfo[]): boolean {
  return providers.some(
    (provider) =>
      (provider.name === "claude" || provider.name === "codex") &&
      (provider.applicationDetected ?? provider.installed),
  );
}

export function DesktopProviderNotice() {
  const { t } = useI18n();
  const { version } = useVersion();
  const { providers, loading, error, refetch } = useProviders();
  const [dismissed, setDismissed] = useState(() =>
    readDesktopProviderNoticeDismissed(),
  );

  useEffect(() => {
    if (version?.desktopRuntime !== true) return;
    const refresh = () => void refetch();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refetch, version?.desktopRuntime]);

  if (
    dismissed ||
    version?.desktopRuntime !== true ||
    loading ||
    error ||
    hasDesktopProviderRuntime(providers)
  ) {
    return null;
  }

  return (
    <aside className={styles.root} aria-live="polite">
      <div className={styles.copy}>
        <strong className={styles.title}>
          {t("desktopProviderNoticeTitle")}
        </strong>
        <span className={styles.description}>
          {t("desktopProviderNoticeDescription")}
        </span>
      </div>
      <div className={styles.actions}>
        <a
          className={styles.action}
          href={CLAUDE_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
        >
          {t("desktopProviderNoticeGetClaude")}
        </a>
        <a
          className={styles.action}
          href={CODEX_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
        >
          {t("desktopProviderNoticeGetCodex")}
        </a>
        <button
          type="button"
          className={styles.action}
          onClick={() => void refetch()}
        >
          {t("desktopProviderNoticeRetry")}
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.dismiss}`}
          aria-label={t("desktopProviderNoticeDismiss")}
          onClick={() => {
            writeDesktopProviderNoticeDismissed();
            setDismissed(true);
          }}
        >
          <XIcon size={DISMISS_ICON_SIZE} />
        </button>
      </div>
    </aside>
  );
}
