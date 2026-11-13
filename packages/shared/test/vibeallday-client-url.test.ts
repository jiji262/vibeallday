import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIBEALLDAY_CLIENT_BASE_URL,
  buildVibeAllDayClientPublicShareBaseUrl,
  buildVibeAllDayClientPublicShareUrl,
  buildVibeAllDayClientRelayLoginUrl,
  normalizeVibeAllDayClientBaseUrl,
  normalizeVibeAllDayClientBaseUrlFromShareViewerUrl,
} from "../src/vibeallday-client-url.js";

describe("normalizeVibeAllDayClientBaseUrl", () => {
  it("keeps the default hosted client canonical", () => {
    expect(
      normalizeVibeAllDayClientBaseUrl(DEFAULT_VIBEALLDAY_CLIENT_BASE_URL),
    ).toBe(DEFAULT_VIBEALLDAY_CLIENT_BASE_URL);
  });

  it("accepts a bare VIBEALLDAY host or address", () => {
    expect(normalizeVibeAllDayClientBaseUrl("vibeallday.navs.dpdns.org")).toBe(
      "https://vibeallday.navs.dpdns.org",
    );
    expect(normalizeVibeAllDayClientBaseUrl("192.168.1.25:3400")).toBe(
      "https://192.168.1.25:3400",
    );
  });

  it("preserves explicit HTTP origins and app path prefixes", () => {
    expect(normalizeVibeAllDayClientBaseUrl("http://localhost:3400")).toBe(
      "http://localhost:3400",
    );
    expect(
      normalizeVibeAllDayClientBaseUrl("https://example.com/remote/"),
    ).toBe("https://example.com/remote");
  });

  it("rejects non-HTTP URLs and URL extras", () => {
    expect(() => normalizeVibeAllDayClientBaseUrl("wss://example.com")).toThrow(
      "VIBEALLDAY URL must use http:// or https://",
    );
    expect(() =>
      normalizeVibeAllDayClientBaseUrl("example.com?debug=1"),
    ).toThrow("VIBEALLDAY URL must not include query or hash");
    expect(() =>
      normalizeVibeAllDayClientBaseUrl("https://user@example.com"),
    ).toThrow("VIBEALLDAY URL must not include credentials");
  });
});

describe("VIBEALLDAY client route builders", () => {
  it("builds login and share routes under the default /remote prefix", () => {
    expect(
      buildVibeAllDayClientRelayLoginUrl(DEFAULT_VIBEALLDAY_CLIENT_BASE_URL),
    ).toBe("https://vibeallday.navs.dpdns.org/remote/login/relay");
    expect(
      buildVibeAllDayClientPublicShareUrl(
        "abc/def",
        DEFAULT_VIBEALLDAY_CLIENT_BASE_URL,
      ),
    ).toBe("https://vibeallday.navs.dpdns.org/remote/share/abc%2Fdef");
  });

  it("builds login and share routes at a custom root host", () => {
    expect(
      buildVibeAllDayClientRelayLoginUrl("vibeallday.navs.dpdns.org"),
    ).toBe("https://vibeallday.navs.dpdns.org/login/relay");
    expect(
      buildVibeAllDayClientPublicShareBaseUrl("vibeallday.navs.dpdns.org"),
    ).toBe("https://vibeallday.navs.dpdns.org/share");
  });

  it("converts legacy share-viewer URLs to VIBEALLDAY client bases", () => {
    expect(
      normalizeVibeAllDayClientBaseUrlFromShareViewerUrl(
        "https://vibeallday.navs.dpdns.org/share",
      ),
    ).toBe("https://vibeallday.navs.dpdns.org");
    expect(
      normalizeVibeAllDayClientBaseUrlFromShareViewerUrl(
        "https://example.com/remote/share",
      ),
    ).toBe("https://example.com/remote");
  });
});
