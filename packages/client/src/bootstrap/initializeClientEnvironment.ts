import { initializeContentMaxWidth } from "../hooks/useContentMaxWidth";
import { initializeFontSize } from "../hooks/useFontSize";
import { initializeOutputAppearance } from "../hooks/useOutputAppearance";
import { initializeSidebarSpacing } from "../hooks/useSidebarSpacing";
import { initializeTabSize } from "../hooks/useTabSize";
import { initializeTheme } from "../hooks/useTheme";
import { initializeTooltipAppearance } from "../hooks/useTooltipAppearance";
import { installFontDiagnostics } from "../lib/diagnostics/fontDiagnostics";
import { installModifierChordTracking } from "../lib/modifierChords";
import { initializeUnicodeProseMath } from "../lib/unicodeProseMath";

/**
 * Shared startup initialization run synchronously before React mounts in both
 * local (`main.tsx`) and remote (`remote-main.tsx`) client entry points.
 * Applies stored appearance tokens to `<html>` before first paint and kicks off
 * non-blocking PWA service worker registration.
 */
export function initializeClientEnvironment(): void {
  installModifierChordTracking();
  initializeTheme();
  initializeFontSize();
  initializeSidebarSpacing();
  initializeOutputAppearance();
  installFontDiagnostics();
  initializeTabSize();
  initializeContentMaxWidth();
  initializeTooltipAppearance();
  initializeUnicodeProseMath();

  void import("../lib/registerServiceWorker").then(
    ({ registerServiceWorkerAtStartup }) => registerServiceWorkerAtStartup(),
  );
}
