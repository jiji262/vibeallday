import { describe, expect, it } from "vitest";
import { normalizeStartupEnv } from "../src/startupEnv.js";

describe("normalizeStartupEnv", () => {
  it("preserves the independent application's canonical configuration", () => {
    const env: NodeJS.ProcessEnv = {
      VIBEALLDAY_DATA_DIR: "/private/data",
      VIBEALLDAY_PROFILE: "work",
      VIBEALLDAY_VOICE_BACKENDS: "whisper",
      VIBEALLDAY_COMPOSE_ANCHORS: "1",
      VIBEALLDAY_CLIENT_BASE_URL: "https://app.example.test/remote",
    };
    const original = { ...env };
    normalizeStartupEnv(env);
    expect(env).toEqual(original);
  });

  it("normalizes the provider's executable alias", () => {
    const env: NodeJS.ProcessEnv = { PI_PATH: "/tools/pi" };
    normalizeStartupEnv(env);
    expect(env).toEqual({ PI_EXECUTABLE: "/tools/pi" });
  });

  it("keeps an explicit executable when the provider alias is also set", () => {
    const env: NodeJS.ProcessEnv = {
      PI_EXECUTABLE: "/tools/pi-current",
      PI_PATH: "/tools/pi-other",
    };
    normalizeStartupEnv(env);
    expect(env).toEqual({ PI_EXECUTABLE: "/tools/pi-current" });
  });
});
