import { type ReactNode, useId } from "react";
import styles from "./NewSessionAdvancedGroups.module.css";

export interface NewSessionAdvancedGroup {
  key: string;
  title: string;
  /** The form's existing option sections; null entries are skipped. */
  content: ReactNode;
}

function AdvancedGroup({
  title,
  content,
}: Omit<NewSessionAdvancedGroup, "key">) {
  const titleId = useId();
  return (
    <section
      className={styles.group}
      aria-labelledby={titleId}
      data-new-session-advanced-group="true"
    >
      <h3 id={titleId} className={styles.title}>
        {title}
      </h3>
      <div className={styles.body}>{content}</div>
    </section>
  );
}

/**
 * The Advanced sheet's groups (Performance, Safety, Where it runs). A group
 * whose options all render nothing is hidden by its stylesheet, so callers
 * can pass components that decide their own visibility.
 */
export function NewSessionAdvancedGroups({
  groups,
}: {
  groups: NewSessionAdvancedGroup[];
}) {
  return (
    <>
      {groups.map(({ key, ...group }) => (
        <AdvancedGroup key={key} {...group} />
      ))}
    </>
  );
}
