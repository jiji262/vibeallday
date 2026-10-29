import {
  MAX_SIDEBAR_CATEGORY_LENGTH,
  normalizeSidebarCategory,
} from "@vibeallday/shared";
import { useState } from "react";
import { useI18n } from "../i18n";
import { FolderIcon } from "./garden/icons";
import styles from "./SessionMenu.module.css";

const MENU_ICON_SIZE = 14;

/**
 * The category entry of the session menu. Its choices stay folded until
 * asked for, so the menu keeps its length; a new name is typed in place
 * rather than in a separate dialog.
 */
export function SessionMenuCategoryPicker({
  current,
  names,
  onChoose,
}: {
  current?: string;
  names: readonly string[];
  /** Files the session under a category (or none) and closes the menu. */
  onChoose: (category: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <FolderIcon size={MENU_ICON_SIZE} />
        {t("sessionMenuMoveToCategory")}
      </button>
      {open && (
        <CategoryChoices
          current={current}
          names={names}
          draft={draft}
          onDraftChange={setDraft}
          onChoose={onChoose}
        />
      )}
    </>
  );
}

function CategoryChoices({
  current,
  names,
  draft,
  onDraftChange,
  onChoose,
}: {
  current?: string;
  names: readonly string[];
  draft: string | null;
  onDraftChange: (draft: string | null) => void;
  onChoose: (category: string | null) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.categoryChoices}>
      {names.map((name) => (
        <button
          type="button"
          key={name}
          aria-pressed={name === current}
          onClick={() => onChoose(name === current ? null : name)}
        >
          <span className={styles.categoryCheck} aria-hidden="true">
            {name === current ? "✓" : ""}
          </span>
          {name}
        </button>
      ))}
      {draft === null ? (
        <button type="button" onClick={() => onDraftChange("")}>
          <span className={styles.categoryCheck} aria-hidden="true" />
          {t("sessionMenuNewCategory")}
        </button>
      ) : (
        <NewCategoryForm
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={(name) => onChoose(name)}
        />
      )}
      {current && (
        <button type="button" onClick={() => onChoose(null)}>
          <span className={styles.categoryCheck} aria-hidden="true" />
          {t("sessionMenuRemoveFromCategory")}
        </button>
      )}
    </div>
  );
}

function NewCategoryForm({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  onDraftChange: (draft: string | null) => void;
  onSubmit: (name: string) => void;
}) {
  const { t } = useI18n();
  return (
    <form
      className={styles.newCategoryForm}
      onSubmit={(event) => {
        event.preventDefault();
        const name = normalizeSidebarCategory(draft);
        if (name) onSubmit(name);
      }}
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: The reader just asked to type a name here.
        autoFocus
        type="text"
        value={draft}
        maxLength={MAX_SIDEBAR_CATEGORY_LENGTH}
        placeholder={t("sessionMenuNewCategoryPlaceholder")}
        aria-label={t("sessionMenuNewCategory")}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onDraftChange(null);
          }
        }}
      />
    </form>
  );
}
