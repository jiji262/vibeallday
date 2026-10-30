import { useI18n } from "../../i18n";
import { Kbd } from "../garden/Kbd";
import styles from "./CommandPalette.module.css";

/** Keyboard hints; hidden on touch screens, where there is no keyboard. */
export function CommandPaletteFooter() {
  const { t } = useI18n();
  return (
    <footer className={styles.footer} aria-hidden="true">
      <span className={styles.footerHint}>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {t("paletteHintMove")}
      </span>
      <span className={styles.footerHint}>
        <Kbd>{t("kbdEnter")}</Kbd>
        {t("paletteHintOpen")}
      </span>
      <span className={styles.footerHint}>
        <Kbd>{t("kbdTab")}</Kbd>
        {t("paletteHintNextGroup")}
      </span>
      <span className={styles.footerHint}>
        <Kbd>{t("kbdEscape")}</Kbd>
        {t("paletteHintClose")}
      </span>
    </footer>
  );
}
