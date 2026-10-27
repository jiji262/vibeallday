import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { LoadingState } from "../../components/garden/LoadingState";
import { useI18n } from "../../i18n";

/** Keep pane acquisition and failure inside the Settings navigation shell. */
export function SettingsPane({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <div data-settings-pane>
      <ErrorBoundary>
        <Suspense
          fallback={
            <LoadingState
              label={label ? `${label}: ${t("loading")}` : t("loading")}
            />
          }
        >
          <div data-settings-pane-ready>{children}</div>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
