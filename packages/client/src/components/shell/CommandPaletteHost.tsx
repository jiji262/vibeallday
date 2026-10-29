import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CommandPaletteContext,
  type CommandPaletteControls,
} from "./CommandPaletteContext";
import { isCommandPaletteShortcut } from "./shortcut";

const CommandPalette = lazy(() => import("./CommandPalette"));

/**
 * Owns the palette's open state and its shortcut. The listener is passive
 * for every other key: it reads the event and returns, so typing elsewhere
 * never re-renders the app. The palette chunk loads on first open.
 */
export function CommandPaletteHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openPalette = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    const focused = document.activeElement;
    returnFocus.current = focused instanceof HTMLElement ? focused : null;
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    const target = returnFocus.current;
    returnFocus.current = null;
    // Navigation may have removed the element; focus only what remains.
    if (target?.isConnected) target.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event)) return;
      event.preventDefault();
      openPalette();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette]);

  const controls = useMemo<CommandPaletteControls>(
    () => ({ open: openPalette }),
    [openPalette],
  );

  return (
    <CommandPaletteContext.Provider value={controls}>
      {children}
      {open ? (
        <Suspense fallback={null}>
          <CommandPalette onClose={closePalette} />
        </Suspense>
      ) : null}
    </CommandPaletteContext.Provider>
  );
}
