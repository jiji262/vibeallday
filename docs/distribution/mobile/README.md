# Mobile store preparation

Store assets use the independent blue V identity. The English copy in
[`listing.en-US.txt`](listing.en-US.txt) is shared across stores; keep claims
consistent with the shipped build. Private console identifiers, developer
account details, credentials and signing configuration belong in the private
dotfiles runbooks, not here.

## Reusable assets

| Asset | Source / dimensions |
| --- | --- |
| Apple app icon | [`packages/ios/App/Assets.xcassets/AppIcon.appiconset/icon.png`](../../../packages/ios/App/Assets.xcassets/AppIcon.appiconset/icon.png), 1024 × 1024 opaque PNG, bundled in the app |
| Google Play icon | [`packages/android/artwork/play-store-icon.png`](../../../packages/android/artwork/play-store-icon.png), 512 × 512 PNG |
| Google Play feature graphic | [`feature-graphic.png`](feature-graphic.png), 1024 × 500 opaque PNG; editable [`SVG`](feature-graphic.svg) |

Regenerate the feature graphic with librsvg and ImageMagick:

```sh
rsvg-convert docs/distribution/mobile/feature-graphic.svg \
  -o docs/distribution/mobile/feature-graphic.png
magick docs/distribution/mobile/feature-graphic.png -alpha off \
  PNG24:docs/distribution/mobile/feature-graphic.png
```

The graphic is branding, not a simulated app screenshot. Capture actual native
apps against owned sample hosts for store screenshots; do not resize unrelated
browser screenshots or expose real projects, credentials or notification tokens.
Use the console's current accepted device sizes, including iPad for the
universal iOS app. Independent native store screenshots must be captured after the new packages are registered.
See [Google's preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
and [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).

## Independent release preparation

VibeAllDay has no registered App Store or Google Play listing, published APK/AAB,
TestFlight build, or public push broker. Existing source version numbers are not
evidence of a store release. Do not reuse another application's console records,
certificates, notification project, reviewer accounts, or signing identities.

Before a native release:

1. Register the independent application IDs and store records.
2. Configure owned signing credentials and, if needed, a Firebase project.
3. Build and test the actual Android/iOS artifacts against an owned sample host.
4. Capture native screenshots and complete current store privacy declarations.
5. Publish the privacy policy and account-deletion instructions before submission.

The public [privacy policy](https://vibeallday.navs.dpdns.org/privacy) includes
account and local-data deletion guidance. Contact: `jiguofei@msn.com`.
