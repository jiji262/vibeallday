/** Apple platforms bind the palette to ⌘K; plain Ctrl+K stays with Cocoa
 *  text fields there (delete to end of line). */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad|ipod/i.test(platform || navigator.userAgent);
}

/**
 * ⌘K on Apple platforms, Ctrl+K elsewhere; never with Alt or Shift (the
 * transcript's Ctrl+Alt+K stays free). A handler that already consumed the
 * key (`defaultPrevented`) keeps it, as does an IME composition.
 */
export function isCommandPaletteShortcut(
  event: KeyboardEvent,
  apple = isApplePlatform(),
): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.shiftKey) return false;
  if (event.key.toLowerCase() !== "k") return false;
  return apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}
