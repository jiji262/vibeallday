import { CheckIcon, CopyIcon } from "./garden/icons";
import { useCopyFeedback } from "./garden/useCopyFeedback";
import styles from "./FileViewerPath.module.css";

const COPY_ICON_SIZE = 16;
const PATH_SEPARATORS = /[/\\]/;

/** Split at the last separator; a bare name has no directory part. */
function splitPath(path: string): { directory: string; name: string } {
  let cut = -1;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (PATH_SEPARATORS.test(path[index] ?? "")) {
      cut = index;
      break;
    }
  }
  // A trailing separator (directory path) keeps the whole text as the name.
  if (cut < 0 || cut === path.length - 1) {
    return { directory: "", name: path };
  }
  return { directory: path.slice(0, cut + 1), name: path.slice(cut + 1) };
}

/**
 * Breadcrumb-weighted path: the directory reads quietly and the file name
 * carries the ink. The text content stays the full display path, so copy,
 * find, and measurement see exactly the same string as before.
 */
export function FileViewerPathText({ path }: { path: string }) {
  const { directory, name } = splitPath(path);
  return (
    <>
      {directory ? <span className={styles.directory}>{directory}</span> : null}
      <span className={styles.name}>{name}</span>
    </>
  );
}

/** Header icon button that copies the file path; Copy turns to Check. */
export function FileViewerCopyPathButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const { copied, copy } = useCopyFeedback(value);
  const name = copied ? copiedLabel : label;
  return (
    <button
      type="button"
      className={`file-viewer-action ${copied ? "copied" : ""}`}
      aria-label={name}
      title={name}
      onClick={() => {
        void copy();
      }}
    >
      {copied ? (
        <CheckIcon size={COPY_ICON_SIZE} />
      ) : (
        <CopyIcon size={COPY_ICON_SIZE} />
      )}
    </button>
  );
}
