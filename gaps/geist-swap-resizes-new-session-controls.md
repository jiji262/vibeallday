# VIBEALLDAY Geist swap still resizes New Session controls

The client renders in the fallback system font until VIBEALLDAY Geist (added with the
Garden fonts in `fee405a`, `font-display: swap`) arrives. `body` sets no
`line-height`, so every `normal` line box changes height at the swap: Geist's
is exactly 1.3 em and the fallback's is smaller. Measured on New Session at
1000px under a cold load:

- `.new-session-project-input`: 44.0 → 45.8px, so the project chooser aside
  grows 150.4 → 154.2px
- `.new-session-project-summary`: 54.4 → 56.4px
  (`.new-session-project-summary-path` 14 → 16)
- button labels and selected-choice text inside the option controls:
  17 → 18px

`.new-session-subtitle` had the same defect and pushed every startup control
down 2px; it now pins `line-height: 1.3`, and
`e2e/new-session-preboot-composer.spec.ts` holds fonts past its first
measurement so that swap is checked every run. The entries above do not move
those four controls, so the spec does not see them.

Not fixed in place: pinning each element is whack-a-mole. The general fix is
a fallback `@font-face` (`local()` system font with `ascent-override`,
`descent-override`, `line-gap-override`) whose line metrics match Geist, so
the swap changes glyph shapes only. Check `local()` availability on each
platform; a missing face falls through to the unmatched system font.

Found 2026-10-26 while diagnosing the New Session startup-control shift.
Contributing-model: claude-opus-5-5.
