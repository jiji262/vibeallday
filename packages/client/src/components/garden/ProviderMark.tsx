import type { ProviderName } from "@vibeallday/shared";
import styles from "./ProviderMark.module.css";

type ProviderFamily =
  | "claude"
  | "codex"
  | "gemini"
  | "opencode"
  | "grok"
  | "ollama"
  | "pi";

const PROVIDER_FAMILY: Record<ProviderName, ProviderFamily> = {
  claude: "claude",
  "claude-gateway": "claude",
  "claude-ollama": "ollama",
  codex: "codex",
  "codex-oss": "codex",
  gemini: "gemini",
  "gemini-acp": "gemini",
  grok: "grok",
  opencode: "opencode",
  pi: "pi",
};

const FAMILY_LETTER: Record<ProviderFamily, string> = {
  claude: "C",
  codex: "X",
  gemini: "G",
  opencode: "O",
  grok: "K",
  ollama: "L",
  pi: "P",
};

const FAMILY_CLASS: Record<ProviderFamily, string | undefined> = {
  claude: styles.claude,
  codex: styles.codex,
  gemini: styles.gemini,
  opencode: styles.opencode,
  grok: styles.grok,
  ollama: styles.ollama,
  pi: undefined,
};

interface ProviderMarkProps {
  /** Unknown (unreported) providers get the neutral tile with no letter. */
  provider?: ProviderName;
  /** `sm` 16px for inline badges, `md` 20px, `lg` 36px for detail headers. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Provider letter tile (design .prov): a mono letter on a 14% tint of the
 * provider colour. Decorative: the letter is drawn by CSS, so it adds no
 * text to the surrounding label; name the provider in that label.
 */
export function ProviderMark({
  provider,
  size = "md",
  className,
}: ProviderMarkProps) {
  const family = provider ? PROVIDER_FAMILY[provider] : undefined;
  const classes = [
    styles.mark,
    family ? FAMILY_CLASS[family] : "",
    size === "sm" ? styles.sm : "",
    size === "lg" ? styles.lg : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={classes}
      data-letter={family ? FAMILY_LETTER[family] : ""}
      data-provider-family={family}
      aria-hidden="true"
    />
  );
}
