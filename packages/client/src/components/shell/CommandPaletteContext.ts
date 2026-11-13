import { createContext, useContext } from "react";

export interface CommandPaletteControls {
  /** Opens the palette; focus returns to the current element on close. */
  open: () => void;
}

export const CommandPaletteContext =
  createContext<CommandPaletteControls | null>(null);

/** Null outside NavigationLayout, where there is no palette to open. */
export function useCommandPalette(): CommandPaletteControls | null {
  return useContext(CommandPaletteContext);
}
