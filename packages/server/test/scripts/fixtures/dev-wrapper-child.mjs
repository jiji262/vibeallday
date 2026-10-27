#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const isBuild = process.argv.includes("build");
const role = isBuild
  ? "build"
  : process.argv[process.argv.indexOf("--filter") + 1].split("/").pop();
appendFileSync(
  process.env.VIBEALLDAY_TEST_WRAPPER_EVENTS,
  `${JSON.stringify({
    role,
    pid: process.pid,
    port: process.env.VIBEALLDAY_DEV_WRAPPER_PORT,
    token: process.env.VIBEALLDAY_DEV_WRAPPER_TOKEN,
    nodeEnv: process.env.NODE_ENV,
    distPath: process.env.CLIENT_DIST_PATH,
  })}\n`,
);
if (isBuild) {
  if (existsSync(`${process.env.VIBEALLDAY_TEST_WRAPPER_EVENTS}.fail`))
    process.exit(1);
  const directory = process.argv[process.argv.indexOf("--outDir") + 1];
  mkdirSync(join(directory, "assets"), { recursive: true });
  writeFileSync(
    join(directory, "assets", `app-${process.pid}.js`),
    "export {};",
  );
  writeFileSync(
    join(directory, "index.html"),
    "<!doctype html><title>built</title>",
  );
} else {
  setInterval(() => {}, 1000);
}
