// @ts-check
import { createRequire, registerHooks } from "node:module";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

/** @param {unknown} address */
export function assertLoopbackWebSocket(address) {
  const url = new URL(String(address));
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const loopback =
    host === "::1" || (isIP(host) === 4 && host.startsWith("127."));
  if (
    !loopback ||
    !["ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "E2E WebSocket connections require a literal loopback URL without credentials",
    );
  }
}

// 测试子进程统一拦截 ws 入口，产品代码和用户配置不受影响。
export function restrictFixtureWebSockets() {
  const require = createRequire(
    new URL("../../../server/package.json", import.meta.url),
  );
  const entrypoint = require.resolve("ws");
  const original = pathToFileURL(entrypoint).href;
  const wrapper = new URL("wrapper.mjs", original).href;
  const guarded = new URL("./fixture-websocket.mjs", import.meta.url).href;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      return resolved.url === original || resolved.url === wrapper
        ? { ...resolved, url: guarded, format: "module" }
        : resolved;
    },
  });
}
