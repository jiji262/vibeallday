import { describe, expect, it } from "vitest";
import {
  SESSION_TITLE_MAX_LENGTH,
  getSessionDisplayTitle,
  sanitizeSessionTitle,
  truncateSessionTitle,
} from "../../src/session/title.js";

describe("getSessionDisplayTitle", () => {
  it("returns customTitle when set", () => {
    expect(
      getSessionDisplayTitle({ customTitle: "Custom", title: "Auto" }),
    ).toBe("Custom");
  });

  it("returns title when no customTitle", () => {
    expect(getSessionDisplayTitle({ title: "Auto" })).toBe("Auto");
  });

  it("returns 'Untitled' when no titles", () => {
    expect(getSessionDisplayTitle({})).toBe("Untitled");
  });

  it("returns 'Untitled' for null session", () => {
    expect(getSessionDisplayTitle(null)).toBe("Untitled");
  });

  it("returns 'Untitled' for undefined session", () => {
    expect(getSessionDisplayTitle(undefined)).toBe("Untitled");
  });

  it("handles null title", () => {
    expect(getSessionDisplayTitle({ title: null })).toBe("Untitled");
  });
});

describe("SESSION_TITLE_MAX_LENGTH", () => {
  it("is 120 characters", () => {
    expect(SESSION_TITLE_MAX_LENGTH).toBe(120);
  });
});

describe("session title sanitization", () => {
  it("strips invisible controls and bidi formatting", () => {
    expect(sanitizeSessionTitle("  safe\u202Ename\u200B\nnext  ")).toBe(
      "safe name next",
    );
  });

  it("normalizes and truncates sanitized titles", () => {
    const title = `${"x".repeat(130)}\u202E`;
    expect(truncateSessionTitle(title)).toHaveLength(SESSION_TITLE_MAX_LENGTH);
    expect(truncateSessionTitle(title)).toBe(`${"x".repeat(117)}...`);
  });
});
