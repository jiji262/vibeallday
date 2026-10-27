# Chrome Web Store publication

VibeAllDay has an independent development extension identity and has not been
registered or published in Chrome Web Store. No previous application's store
records, credentials, reviewer hosts, signing identity or CI receipts apply.

## Build and verify

```sh
pnpm --filter @vibeallday/browser-extension package:store
pnpm --filter @vibeallday/browser-extension typecheck:acceptance
pnpm --filter @vibeallday/browser-extension acceptance --store-assets
pnpm --filter @vibeallday/browser-extension acceptance
```

The package contains the complete client, worker and panel. It produces
`packages/browser-extension/release/vibeallday-chrome-<version>.zip`, a checksum
and a build record. The package audit checks the manifest, assets, permissions
and pinned development identity. Python 3 is required to create the ZIP.

For local use, build the extension and use Chrome's **Load unpacked** on
`packages/browser-extension/dist`. This installation has its own browser storage.

## Listing assets

| Asset | Dimensions / purpose |
| --- | --- |
| [Store icon](store-icon.png) | 128×128 PNG, independent blue V artwork |
| [Small promotion](small-promo.png) | 440×280, editable [SVG](small-promo.svg) |
| [Marquee promotion](marquee.png) | 1400×560, editable [SVG](marquee.svg), optional |
| [Session](screenshots/01-session.png) | 1280×800, actual packaged app conversation |
| [Issues](screenshots/02-issues.png) | 1280×800, indexed public issue references |
| [Settings](screenshots/03-settings.png) | 1280×800, site access, repository filters and toolbar behavior |
| [English listing](listing.en-US.txt) | Name, summary, description, category and public URLs |
| [Privacy fields](privacy-disclosures.md) | Single purpose, permission justifications and data categories |
| [Privacy policy](privacy.md) | Public policy for the actual extension behavior |

The three app screenshots show the real packaged UI with clearly labeled demo
sessions and synthetic issue references in an isolated profile. They contain no
private transcripts. Regenerate them with the `--store-assets` acceptance command.
A native Chrome side-panel screenshot must be captured separately before store
submission. Promotion images are branding artwork rather than simulated UI.

## Independent store registration

1. Register an owned Chrome Web Store item and verify its assigned public key.
2. Update `identity.json` and all dependent client/relay allowlists if the store
   assigns an ID different from the development identity.
3. Configure owned publishing credentials and GitHub environment variables.
4. Verify the actual ZIP, reviewer access, privacy disclosures and store assets.
5. Set `storeRegistered` only after registration, then explicitly request a release.

The publication entry point rejects an unregistered identity. Do not enable an
upload or publication workflow before these steps are complete. Workflow success
alone does not establish that Google has reviewed or published an extension.
