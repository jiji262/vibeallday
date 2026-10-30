import { Navigate } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";

/** Route stub for one-by-one triage; until it ships, /triage opens Inbox. */
export function TriagePage() {
  const basePath = useRemoteBasePath();
  return <Navigate to={`${basePath}/inbox`} replace />;
}
