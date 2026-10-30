import { useActivityBusState } from "../../hooks/useActivityBusState";
import type { MessageKey } from "../../i18n";
import type { StatusState } from "../garden/StatusDot";

export interface HostConnection {
  /** Status shape and colour: ok, reconnecting (run) or lost (err). */
  state: StatusState;
  labelKey: MessageKey;
}

const CONNECTION: Record<
  ReturnType<typeof useActivityBusState>["connectionState"],
  HostConnection
> = {
  connected: { state: "ok", labelKey: "shellHostConnected" },
  reconnecting: { state: "run", labelKey: "shellHostReconnecting" },
  disconnected: { state: "err", labelKey: "shellHostDisconnected" },
};

/** The current source transport's state, as the host chip and card show it. */
export function useHostConnection(): HostConnection {
  const { connectionState } = useActivityBusState();
  return CONNECTION[connectionState];
}
