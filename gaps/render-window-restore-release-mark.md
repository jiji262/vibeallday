# Render-window anchor restores may hand a released reader back to Follow

`useTranscriptRenderWindow` keeps the first visible row in place when measured
row heights replace estimates: its layout effect (around
`packages/client/src/hooks/useTranscriptRenderWindow.ts:373`) calls
`restoreScrollToAnchorRow`, moving `scrollTop` by the height that changed above
the row. `MessageList`'s `handleScroll` decides that a released reader has
returned to the tail when `scrollTop` exceeds `readerReleaseLowScrollTopRef` by
more than 4 px while the last line is in view. The hook neither mutes that
scroll event nor moves the release mark, so in a windowed transcript a reader
within the bottom slack could be pulled back to Follow by measurement alone.
Older-page restores in `MessageList` already move the mark (`shiftReleaseMark`).

Not reproduced. `e2e/older-history-reading-position.spec.ts` lands 120 turns
(render weight 240, so the window is active) under a released reader whose
last line stays in view, and checks Follow again 500 ms later; it passed
20 of 20 runs at 1200 px and 375 px. A jsdom probe cannot lay rows out.
The same exposure predates the older-page fix.

Cheap fixes, if a reproduction appears: have the hook report each restore's
shift to `MessageList`, which passes it to `shiftReleaseMark`; or record the
release relative to the end of content (`scrollHeight - scrollTop`), which no
height change above the viewport moves, and drop the per-writer shifts.

Found 2026-10-25 while reviewing the older-page reading-position fix.
Contributing-model: claude-opus-5-5.
