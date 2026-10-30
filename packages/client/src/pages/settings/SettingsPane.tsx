import {
  createContext,
  type ReactNode,
  Suspense,
  useContext,
  useEffect,
} from "react";
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

/**
 * A pane's open item (`/settings/:category/:itemId`): the third breadcrumb
 * segment, `设置 › 分类 › 项`, and where Back goes from it.
 */
export interface SettingsDetailCrumb {
  label: string;
  /** Route Back and the category crumb lead to, e.g. the category list. */
  backTo: string;
}

const SettingsDetailCrumbContext = createContext<
  ((crumb: SettingsDetailCrumb | null) => void) | null
>(null);

export const SettingsDetailCrumbProvider = SettingsDetailCrumbContext.Provider;

/**
 * Register the item a pane has open; pass null when none is. Panes mounted
 * in search results get no provider, so the call is a no-op there.
 */
export function useSettingsDetailCrumb(
  crumb: SettingsDetailCrumb | null,
): void {
  const register = useContext(SettingsDetailCrumbContext);
  const label = crumb?.label;
  const backTo = crumb?.backTo;
  useEffect(() => {
    if (!register) return;
    register(label && backTo ? { label, backTo } : null);
    return () => register(null);
  }, [register, label, backTo]);
}
