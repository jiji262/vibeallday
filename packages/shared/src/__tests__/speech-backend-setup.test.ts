import { describe, expect, it } from "vitest";
import {
  isLocalSpeechBackendId,
  parseSpeechVoiceBackends,
  unionSpeechVoiceBackends,
} from "../speech-backend-setup.js";

describe("speech backend setup ids", () => {
  it("parses and unions local backend ids without dropping settings entries", () => {
    expect(parseSpeechVoiceBackends(undefined)).toEqual([]);
    expect(
      parseSpeechVoiceBackends(["vibeallday-granite", "vibeallday-granite"]),
    ).toEqual(["vibeallday-granite"]);
    expect(parseSpeechVoiceBackends(["vibeallday-grok"])).toBeNull();
    expect(parseSpeechVoiceBackends("vibeallday-whisper")).toBeNull();
    expect(isLocalSpeechBackendId("vibeallday-nemo")).toBe(true);
    expect(isLocalSpeechBackendId("vibeallday-dummy")).toBe(false);
    expect(
      unionSpeechVoiceBackends(
        ["vibeallday-whisper", "vibeallday-grok"],
        ["vibeallday-granite", "vibeallday-whisper"],
      ),
    ).toEqual(["vibeallday-whisper", "vibeallday-granite"]);
  });
});
