import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/garden/Button";
import { RefreshIcon } from "../components/garden/icons";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import styles from "./DeviceHeaderActions.module.css";

/**
 * Design 测试设备 header: the bridge settings, then an explicit re-scan.
 * Refresh is absent while the bridge still has to be downloaded.
 */
export function DeviceHeaderActions({
  onRefresh,
}: {
  onRefresh?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const base = useRemoteBasePath();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <span className={styles.actions}>
      <Link className={styles.settingsLink} to={`${base}/settings/emulator`}>
        {t("emulatorBridgeSettings")}
      </Link>
      {onRefresh && (
        <Button
          size="sm"
          icon={<RefreshIcon />}
          loading={refreshing}
          onClick={() => void refresh()}
        >
          {t("emulatorRefreshDevices")}
        </Button>
      )}
    </span>
  );
}
