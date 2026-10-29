import styles from "./pageWidth.module.css";

/**
 * `wide` fills the main column up to `--page-max-width` (lists, dashboards).
 * `narrow` suits settings-like pages, `form` single forms, and `reading`
 * follows the reader's content-width preference.
 */
export type PageWidth = "wide" | "narrow" | "form" | "reading";

const PAGE_WIDTH_CLASS: Record<PageWidth, string> = {
  wide: "",
  narrow: styles.narrow ?? "",
  form: styles.form ?? "",
  reading: styles.reading ?? "",
};

/** Class for the `.page-content-inner` element. */
export function pageWidthClass(width: PageWidth): string {
  return PAGE_WIDTH_CLASS[width];
}
