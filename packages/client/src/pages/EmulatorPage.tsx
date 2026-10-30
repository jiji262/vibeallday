import {
  DEVICE_BRIDGE_CAPABILITY,
  DEVICE_BRIDGE_DOWNLOAD_CAPABILITY,
  type DeviceInfo,
  serverHasCapability,
} from "@vibeallday/shared";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Button } from "../components/garden/Button";
import { Card, CardBody, CardHeader } from "../components/garden/Card";
import { EmptyState } from "../components/garden/EmptyState";
import { ErrorState } from "../components/garden/ErrorState";
import { SmartphoneIcon } from "../components/garden/icons";
import { LoadingState } from "../components/garden/LoadingState";
import { Notice } from "../components/garden/Notice";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useEmulators } from "../hooks/useEmulators";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { DeviceHeaderActions } from "./DeviceHeaderActions";
import { DeviceList, firstStreamableDevice } from "./EmulatorDeviceList";
import styles from "./EmulatorPage.module.css";
import { StreamView } from "./EmulatorStreamView";

export function BridgeRuntimePrompt({
  mode,
  installedVersion,
  latestVersion,
  onDownloaded,
}: {
  mode: "download" | "update";
  installedVersion?: string | null;
  latestVersion?: string | null;
  onDownloaded: () => void;
}) {
  const { t } = useI18n();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = mode === "update";

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const result = await api.downloadDeviceBridge();
      if (result.ok) onDownloaded();
      else setError(result.error ?? t("emulatorBridgeDownloadFailed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card as="section" className={styles.downloadPrompt}>
      <CardHeader
        title={t(
          update ? "emulatorBridgeUpdateTitle" : "emulatorBridgeDownloadTitle",
        )}
      />
      <CardBody className={styles.downloadBody}>
        <p className={styles.downloadCopy}>
          {update ? (
            <>
              {t("emulatorBridgeUpdateRequired")}
              {installedVersion && latestVersion
                ? ` ${t("emulatorBridgeVersions", {
                    installed: installedVersion,
                    latest: latestVersion,
                  })}`
                : null}
            </>
          ) : (
            t("emulatorBridgeDownloadRequired")
          )}
        </p>
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <div>
          <Button
            variant="primary"
            onClick={handleDownload}
            loading={downloading}
          >
            {downloading
              ? t(
                  update
                    ? "emulatorBridgeUpdating"
                    : "emulatorBridgeDownloading",
                )
              : t(update ? "emulatorBridgeUpdate" : "emulatorBridgeDownload")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/** Test devices: device classes as cards, then a live stream per device. */
export function EmulatorPage() {
  const { t } = useI18n();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const { version: versionInfo, refetch: refetchVersion } = useVersion();
  const bridgeRuntimeMode =
    versionInfo?.deviceBridgeState === "update-available"
      ? "update"
      : serverHasCapability(versionInfo, DEVICE_BRIDGE_DOWNLOAD_CAPABILITY) &&
          !serverHasCapability(versionInfo, DEVICE_BRIDGE_CAPABILITY)
        ? "download"
        : null;
  const needsDownload = bridgeRuntimeMode !== null;

  const { emulators, loading, error, startEmulator, stopEmulator, refresh } =
    useEmulators({ enabled: !needsDownload });
  const [activeDevice, setActiveDevice] = useState<DeviceInfo | null>(null);

  // ?auto — auto-connect to the first streamable running device in UI order.
  useEffect(() => {
    if (activeDevice || loading || needsDownload) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("auto")) return;
    const streamable = firstStreamableDevice(emulators);
    if (streamable) setActiveDevice(streamable);
  }, [emulators, loading, activeDevice, needsDownload]);

  if (activeDevice) {
    return (
      <MainContent isWideScreen={isWideScreen}>
        <StreamView
          device={activeDevice}
          onBack={() => setActiveDevice(null)}
        />
      </MainContent>
    );
  }

  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={t("sidebarDevices")}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("wide")}`}>
          <PageIntro
            eyebrow={[t("sidebarGroupTools")]}
            title={t("sidebarDevices")}
            lede={t("emulatorPageLede")}
            actions={
              <DeviceHeaderActions
                onRefresh={needsDownload ? undefined : refresh}
              />
            }
          />
          <Notice tone="warning" className={styles.experimental}>
            <strong>{t("emulatorExperimentalNoticeTitle")}</strong>{" "}
            {t("emulatorExperimentalNotice")}
          </Notice>
          {bridgeRuntimeMode ? (
            <BridgeRuntimePrompt
              mode={bridgeRuntimeMode}
              installedVersion={versionInfo?.deviceBridgeVersion}
              latestVersion={versionInfo?.latestDeviceBridgeVersion}
              onDownloaded={refetchVersion}
            />
          ) : (
            <>
              {loading && (
                <LoadingState label={t("emulatorPageLoading")} rows={3} />
              )}
              {error && <ErrorState tag={t("errorTag")} message={error} />}
              {!loading && !error && emulators.length === 0 && (
                <EmptyState
                  title={t("emulatorPageEmptyTitle")}
                  hint={t("emulatorPageNoDevices")}
                  icon={<SmartphoneIcon />}
                />
              )}
              {emulators.length > 0 && (
                <DeviceList
                  devices={emulators}
                  onConnect={setActiveDevice}
                  onStart={startEmulator}
                  onStop={stopEmulator}
                />
              )}
            </>
          )}
        </div>
      </main>
    </MainContent>
  );
}
