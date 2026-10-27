import { readFile } from "node:fs/promises";

const globalStylesheetUrls = [
  new URL("../theme.css", import.meta.url),
  new URL("../index.css", import.meta.url),
];

/** Tokens live in theme.css and shell rules in index.css; contracts span both. */
export async function readGlobalStyles(): Promise<string> {
  const parts = await Promise.all(
    globalStylesheetUrls.map((url) => readFile(url, "utf8")),
  );
  return parts.join("\n");
}
