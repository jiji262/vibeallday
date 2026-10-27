import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { MANAGED_ARTIFACT_MAX_FILE_BYTES } from "../packages/shared/dist/artifact-viewer.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { serve } from "./host.mjs";
const origin =
  "https://artifact-0123456789abcdef0123456789abcdef.vibeallday.navs.dpdns.org";
const assets = {
  "bootstrap.js": "bootstrap bytes",
  "worker.js": "worker bytes",
  "frame.js": "frame bytes",
};
const bootstrap =
  "/__vibeallday/1/bootstrap.html?viewer=0123456789abcdef0123456789abcdef&parent=https%3A%2F%2Flatest.vibeallday.navs.dpdns.org";
test("content host serves only fixed files on reserved hosts and allowed parents", async () => {
  const response = serve(new Request(origin + bootstrap), assets);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-security-policy"),
    /frame-ancestors https:\/\/vibeallday.navs.dpdns.org https:\/\/latest.vibeallday.navs.dpdns.org/,
  );
  assert.equal(response.headers.get("origin-agent-cluster"), "?1");
  assert.match(
    await response.text(),
    /name="vibeallday-parent-origin" content="https:\/\/latest.vibeallday.navs.dpdns.org"/,
  );
  for (const path of [
    "/v/anything/index.html",
    "/api/version",
    "/__vibeallday/2/worker.js",
    "/",
  ])
    assert.equal(serve(new Request(origin + path), assets).status, 404);
  assert.equal(
    serve(
      new Request("https://vibeallday-relay.navs.dpdns.org" + bootstrap),
      assets,
    ).status,
    404,
  );
  assert.equal(
    serve(
      new Request(
        origin +
          bootstrap.replace("latest.vibeallday.navs.dpdns.org", "evil.example"),
      ),
      assets,
    ).status,
    400,
  );
  assert.equal(
    serve(new Request(origin + bootstrap, { method: "POST" }), assets).status,
    404,
  );
});
test("worker scope and HEAD stay bounded independently of artifact contents", async () => {
  const script = serve(
    new Request(origin + "/__vibeallday/1/worker.js"),
    assets,
  );
  assert.equal(await script.text(), "worker bytes");
  assert.equal(script.headers.get("service-worker-allowed"), "/v/");
  const head = serve(
    new Request(origin + "/__vibeallday/1/frame.js", { method: "HEAD" }),
    assets,
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("the standalone worker's file bound matches the server and parent", async () => {
  const source = await readFile(
    new URL("./worker.js", import.meta.url),
    "utf8",
  );
  const bound = runInNewContext(`${source}\nMAX_FILE_BYTES`, {
    self: { addEventListener() {} },
  });
  assert.equal(bound, MANAGED_ARTIFACT_MAX_FILE_BYTES);
});
