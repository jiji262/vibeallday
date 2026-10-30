import { Navigate } from "react-router-dom";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";

/**
 * Route stub for a project's home page. Until it ships, /projects/:projectId
 * keeps its existing redirect to the session list.
 */
export function ProjectHomePage() {
  const basePath = useRemoteBasePath();
  return <Navigate to={`${basePath}/sessions`} replace />;
}
