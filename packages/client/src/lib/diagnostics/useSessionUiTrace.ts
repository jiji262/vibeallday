import { useMemo } from "react";
import { useCurrentSourceRuntime } from "../../contexts/SourceRuntimeContext";
import { captureClientLogTarget } from "./ClientLogTarget";
import { createSourceSessionUiTrace } from "./uiTrace";

/** 异步回调保留发起操作时的来源，新的操作随渲染获取新的 recorder。 */
export function useSessionUiTrace() {
  const runtime = useCurrentSourceRuntime();
  const destination = captureClientLogTarget(runtime.sourceKey)?.key ?? null;
  return useMemo(
    () => createSourceSessionUiTrace(runtime.sourceKey, destination),
    [runtime.sourceKey, destination],
  );
}
