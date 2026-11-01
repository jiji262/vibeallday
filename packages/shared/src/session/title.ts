/** Shared session title sanitization and display helpers. */

/** Maximum length for truncated titles */
export const SESSION_TITLE_MAX_LENGTH = 120;

// biome-ignore lint/complexity/useRegexLiterals: constructor form keeps deliberate control-character ranges explicit
const UNSAFE_TITLE_CHARACTERS = new RegExp(
  String.raw`[\u0000-\u001f\u007f-\u009f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]`,
  "gu",
);

/**
 * Sanitize text before it is reused as a session/browser title.
 *
 * Titles are shown in multiple browser/OS surfaces, so strip invisible
 * controls and bidi formatting rather than trying to preserve exact input.
 */
export function sanitizeSessionTitle(title: string): string {
  return title
    .normalize("NFC")
    .replace(UNSAFE_TITLE_CHARACTERS, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function truncateSessionTitle(title: string): string {
  const sanitized = sanitizeSessionTitle(title);
  if (sanitized.length <= SESSION_TITLE_MAX_LENGTH) return sanitized;
  return `${sanitized.slice(0, SESSION_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

/**
 * Standalone utility function for getting display title from session-like objects.
 *
 * @param session - Object with optional title fields
 * @returns The display title (customTitle > title > "Untitled")
 */
export function getSessionDisplayTitle(
  session: { customTitle?: string; title?: string | null } | null | undefined,
): string {
  if (!session) return "Untitled";
  return session.customTitle ?? session.title ?? "Untitled";
}
