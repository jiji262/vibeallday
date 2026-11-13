import { createRequire } from "node:module";
import { readFile, writeFile, copyFile } from "node:fs/promises";
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
await promotion("site/public/branding/og-image", 1200, 630);
await copyFile(
  join(root, "site/public/branding/og-image.png"),
  join(root, "site/public/branding/og-product-v2.png"),
);

console.log("Generated VibeAllDay web icons and promotional assets");
