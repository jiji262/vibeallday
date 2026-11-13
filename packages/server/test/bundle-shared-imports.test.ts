import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { rewriteSharedImports } from "../../../scripts/rewrite-shared-imports.js";

it("loads rewritten root, flat, nested and dotted imports without workspace links", () => {
  const root = mkdtempSync(join(tmpdir(), "vibeallday bundle imports "));
  try {
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    const modules = {
      "index.js": 'export const root = "root";',
      "sqlite.js": 'export const flat = "flat";',
      "experimental/simple-client.generated.js":
        'export const schema = "schema";',
      "experimental/conversation-protocol.js":
        'export const protocol = "protocol";',
      "transcript/compiler.js": 'export const compiler = "compiler";',
      "transcript/parsers/bash.js": 'export const parser = "parser";',
      "server-runtime.js": 'globalThis.sideEffect = "side effect";',
    };
    for (const [name, source] of Object.entries(modules)) {
      const file = join(root, "bundled/shared/dist", name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, source);
    }
    const source = `
      import { root } from "@vibeallday/shared";
      import { flat } from '@vibeallday/shared/sqlite';
      import { schema } from "@vibeallday/shared/experimental/simple-client.generated";
      export { protocol } from "@vibeallday/shared/experimental/conversation-protocol";
      import { compiler } from "@vibeallday/shared/transcript/compiler";
      import "@vibeallday/shared/server-runtime";
      const { parser } = await import("@vibeallday/shared/transcript/parsers/bash");
      export const values = [root, flat, schema, compiler, parser, globalThis.sideEffect];
    `;
    const entry = join(root, "entry.js");
    writeFileSync(
      entry,
      rewriteSharedImports(source, "./bundled/shared/dist/index.js"),
    );
    const result = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const result = await import(${JSON.stringify(pathToFileURL(entry).href)}); process.stdout.write(JSON.stringify(result));`,
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(result)).toEqual({
      protocol: "protocol",
      values: ["root", "flat", "schema", "compiler", "parser", "side effect"],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("leaves ordinary strings and other package names unchanged", () => {
  const source = `const name = "@vibeallday/shared/experimental/simple-client.generated";
import { value } from "@vibeallday/shared-other";`;
  expect(rewriteSharedImports(source, "../bundled/shared/dist/index.js")).toBe(
    source,
  );
});
