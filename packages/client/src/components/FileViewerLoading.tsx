import { LoadingState } from "./garden/LoadingState";

/**
 * The file viewer's wait state: the legacy `.file-viewer-loading` frame
 * (centred in the body) around the garden compact loading caption.
 */
export function FileViewerLoading({ label }: { label: string }) {
  return (
    <div className="file-viewer-loading">
      <LoadingState label={label} variant="compact" />
    </div>
  );
}
