import type { ReactNode } from "react";

/**
 * Session-menu glyphs the shared garden set does not carry. They follow the
 * garden convention (24px grid, 1.75 stroke, round caps, currentColor) and
 * are always decorative: every menu entry has its own text label.
 */
const MENU_ICON_SIZE = 14;

function MenuGlyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width={MENU_ICON_SIZE}
      height={MENU_ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function RenameIcon() {
  return (
    <MenuGlyph>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </MenuGlyph>
  );
}

export function CloneIcon() {
  return (
    <MenuGlyph>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </MenuGlyph>
  );
}

export function GenerateTitleIcon() {
  return (
    <MenuGlyph>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
      <path d="m11 8 4 4-4 4" />
      <path d="M8 12h7" />
    </MenuGlyph>
  );
}

export function NudgeIcon() {
  return (
    <MenuGlyph>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </MenuGlyph>
  );
}

export function RecapIcon() {
  return (
    <MenuGlyph>
      <path d="M4 19h16M6 5h12M6 9h12M6 13h8" />
    </MenuGlyph>
  );
}

export function SuggestionIcon() {
  return (
    <MenuGlyph>
      <path d="M9.5 2A7.5 7.5 0 0 0 5 15.5V18a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.5A7.5 7.5 0 0 0 9.5 2Z" />
      <path d="M9 22h2" />
    </MenuGlyph>
  );
}

export function RestoreIcon() {
  return (
    <MenuGlyph>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </MenuGlyph>
  );
}

export function CompactIcon() {
  return (
    <MenuGlyph>
      <path d="M4 14h6v6M4 20l7-7M20 10h-6V4M20 4l-7 7" />
    </MenuGlyph>
  );
}

export function HandoffIcon() {
  return (
    <MenuGlyph>
      <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
    </MenuGlyph>
  );
}

export function ShareIcon() {
  return (
    <MenuGlyph>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </MenuGlyph>
  );
}

export function ArchiveIcon() {
  return (
    <MenuGlyph>
      <path d="M21 8v13H3V8" />
      <rect x="1" y="3" width="22" height="5" />
      <path d="M10 12h4" />
    </MenuGlyph>
  );
}

export function UnreadIcon() {
  return (
    <MenuGlyph>
      <circle cx="12" cy="12" r="9" />
    </MenuGlyph>
  );
}

export function RestartIcon() {
  return (
    <MenuGlyph>
      <path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7" />
    </MenuGlyph>
  );
}

export function TerminateIcon() {
  return (
    <MenuGlyph>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </MenuGlyph>
  );
}
