/** Normalize provider-owned environment aliases before loading configuration. */
export function normalizeStartupEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.PI_EXECUTABLE === undefined && env.PI_PATH !== undefined) {
    env.PI_EXECUTABLE = env.PI_PATH;
  }
  delete env.PI_PATH;
}

normalizeStartupEnv();
