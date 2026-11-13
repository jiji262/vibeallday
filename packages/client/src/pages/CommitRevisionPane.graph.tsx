import { Tag } from "../components/garden/Badge";
import styles from "./CommitRevisionPane.module.css";

/**
 * Linear history graph cell (design GitHistory boards): a vertical line
 * through every row with a node per commit. The list is first-parent order
 * from one branch, so the graph never branches; the line stops at the ends.
 */
export function CommitGraphCell({
  first,
  last,
  head,
}: {
  first: boolean;
  last: boolean;
  /** The repository's HEAD commit gets the filled node. */
  head: boolean;
}) {
  const classes = [
    styles.graph,
    first ? styles.graphFirst : "",
    last ? styles.graphLast : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} aria-hidden="true">
      <span
        className={head ? `${styles.node} ${styles.nodeHead}` : styles.node}
      />
    </span>
  );
}

/** First letter of the author, as the design's small avatar disc. */
export function CommitAuthorInitial({ name }: { name: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span className={styles.avatar} aria-hidden="true">
      {initial}
    </span>
  );
}

/** `HEAD` comes only from repository status: its newest commit is the tip. */
export function HeadTag() {
  return (
    <Tag tone="accent" className={styles.headTag}>
      HEAD
    </Tag>
  );
}
