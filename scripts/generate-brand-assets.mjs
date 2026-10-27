import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, writeFile, copyFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "packages/server/package.json"));
const sharp = require("sharp");
const source = await readFile(join(root, "packages/client/public/icon.svg"));
const glyph =
  '<path d="M 28 32 L 60 88 L 92 32" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>';

async function png(path, size, svg = source) {
  await sharp(svg).resize(size, size).png().toFile(join(root, path));
}

for (const dir of ["packages/client/public", "site/public"]) {
  if (dir === "site/public")
    await writeFile(join(root, dir, "icon.svg"), source);
  for (const size of [192, 512]) await png(`${dir}/icon-${size}.png`, size);
  const badge = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><title>VibeAllDay</title>${glyph}</svg>`,
  );
  await writeFile(join(root, dir, "badge.svg"), badge);
  await png(`${dir}/badge-96.png`, 96, badge);
}

for (const size of [16, 32, 48, 128]) {
  await png(`packages/browser-extension/src/icons/icon-${size}.png`, size);
}
await png("packages/ios/App/Assets.xcassets/AppIcon.appiconset/icon.png", 1024);
await png("packages/android/artwork/play-store-icon.png", 512);
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  await png(
    `packages/android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
    size,
  );
}
for (const name of ["legacy-launcher-icon", "play-store-icon"]) {
  await writeFile(join(root, `packages/android/artwork/${name}.svg`), source);
}
const vector =
  '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:pathData="M30,33 L54,75 L78,33" android:fillColor="@android:color/transparent" android:strokeColor="#ffffff" android:strokeWidth="10" android:strokeLineCap="round" android:strokeLineJoin="round"/></vector>\n';
for (const name of [
  "ic_launcher_foreground",
  "ic_launcher_monochrome",
  "ic_stat_vibeallday",
]) {
  await writeFile(
    join(root, `packages/android/app/src/main/res/drawable/${name}.xml`),
    vector,
  );
}
await writeFile(
  join(
    root,
    "packages/android/app/src/main/res/drawable/ic_launcher_background.xml",
  ),
  '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#2563eb" android:pathData="M0,0h108v108h-108z"/></vector>\n',
);

for (const theme of ["light", "dark"]) {
  const color = theme === "light" ? "#0f172a" : "#f8fafc";
  for (const kind of ["wordmark", "lockup"]) {
    const icon =
      kind === "lockup"
        ? `<g transform="translate(0 5) scale(.5)"><rect width="120" height="120" rx="26" fill="#2563eb"/>${glyph}</g>`
        : "";
    const offset = kind === "lockup" ? 78 : 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${offset + 330} 70"><title>VibeAllDay</title>${icon}<text x="${offset}" y="49" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="${color}">VibeAllDay</text></svg>\n`;
    await writeFile(
      join(root, `site/public/branding/${kind}-${theme}.svg`),
      svg,
    );
  }
}

async function promotion(path, width, height) {
  const scale = height / 240;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>VibeAllDay</title><rect width="${width}" height="${height}" fill="#eff6ff"/><g transform="translate(${height * 0.2} ${height * 0.25}) scale(${scale})"><rect width="120" height="120" rx="26" fill="#2563eb"/>${glyph}</g><text x="${height * 0.8}" y="${height * 0.47}" font-family="Arial, Helvetica, sans-serif" font-size="${height * 0.115}" font-weight="700" fill="#0f172a">VibeAllDay</text><text x="${height * 0.8}" y="${height * 0.62}" font-family="Arial, Helvetica, sans-serif" font-size="${height * 0.052}" fill="#334155">Your coding agents, anywhere.</text></svg>\n`,
  );
  await writeFile(join(root, `${path}.svg`), svg);
  await sharp(svg)
    .png()
    .toFile(join(root, `${path}.png`));
}
await promotion("docs/distribution/mobile/feature-graphic", 1024, 500);
await promotion("docs/distribution/chrome-extension/small-promo", 440, 280);
await promotion("docs/distribution/chrome-extension/marquee", 1400, 560);
await promotion("site/public/branding/og-image", 1200, 630);
await copyFile(
  join(root, "site/public/branding/og-image.png"),
  join(root, "site/public/branding/og-product-v2.png"),
);
await png("docs/distribution/chrome-extension/store-icon.png", 128);

const temporary = await mkdtemp(join(tmpdir(), "vibeallday-icons-"));
execFileSync(
  "pnpm",
  [
    "--dir",
    "packages/desktop",
    "exec",
    "tauri",
    "icon",
    join(root, "packages/client/public/icon.svg"),
    "--output",
    temporary,
  ],
  { cwd: root, stdio: "inherit" },
);
const desktop = "packages/desktop/src-tauri/icons";
for (const name of [
  "32x32.png",
  "128x128.png",
  "128x128@2x.png",
  "icon.png",
  "icon.ico",
  "icon.icns",
  "Square30x30Logo.png",
  "Square44x44Logo.png",
  "Square71x71Logo.png",
  "Square89x89Logo.png",
  "Square107x107Logo.png",
  "Square142x142Logo.png",
  "Square150x150Logo.png",
  "Square284x284Logo.png",
  "Square310x310Logo.png",
  "StoreLogo.png",
]) {
  await copyFile(join(temporary, name), join(root, desktop, name));
}
await png("packages/desktop/src-tauri/icons/64x64.png", 64);
for (const dir of ["packages/client/public", "site/public"]) {
  await copyFile(join(temporary, "icon.ico"), join(root, dir, "favicon.ico"));
}
console.log("Generated VibeAllDay platform icons and promotional assets");
