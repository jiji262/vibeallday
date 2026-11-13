// @vitest-environment node
import { once } from "node:events";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ViteDevServer } from "vite";
import { expect, it } from "vitest";

// Vitest owns another Vite major; exercise the client's declared dependency.
const vitePackage = createRequire(import.meta.url).resolve("vite/package.json");
const viteEntry = pathToFileURL(
  join(dirname(vitePackage), "dist/node/index.js"),
).href;
const { createServer, version } = (await import(
  /* @vite-ignore */ viteEntry
)) as typeof import("vite");

async function reservePort(): Promise<number> {
  const reservation = createTcpServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  await new Promise<void>((resolve, reject) => {
    reservation.close((error) => (error ? reject(error) : resolve()));
  });
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }
  return address.port;
}

it("keeps denied env files private across raw and import queries", async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "vibeallday-vite-deny-")),
  );
  const port = await reservePort();
  const sentinel = "FAKE_VITE_DENY_SENTINEL";
  let server: ViteDevServer | undefined;
  try {
    await Promise.all([
      writeFile(join(root, "index.html"), "<h1>Public fixture</h1>"),
      writeFile(join(root, ".env"), "SECRET=" + sentinel),
    ]);
    server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true, include: [] },
      server: {
        host: "127.0.0.1",
        port,
        strictPort: true,
        fs: { strict: true, allow: [root], deny: ["**/.env"] },
      },
    });
    await server.listen();
    const url = "http://127.0.0.1:" + port;
    const publicPage = await fetch(url + "/index.html");
    expect(publicPage.status).toBe(200);
    expect(await publicPage.text()).toContain("Public fixture");
    const publicModule = await fetch(url + "/index.html?raw");
    expect(publicModule.status).toBe(200);
    expect(await publicModule.text()).toContain("Public fixture");
    for (const query of ["", "?raw", "?import&raw", "?import&url&inline"]) {
      const response = await fetch(url + "/.env" + query);
      expect(response.status, "Vite " + version + " " + query).toBe(403);
      expect(await response.text()).not.toContain(sentinel);
    }
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
