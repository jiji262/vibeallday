import { describe, expect, it } from "vitest";
import { sessionPageRoute } from "../lookup";

const ID = "mcjncehfogglphgkcbiecchdckhojgbe";
const PATH = "/-/relay/kyle/projects/L1VzZXJz%3D/sessions/abc-123";
const ROUTE = {
  relayUsername: "kyle",
  projectId: "L1VzZXJz=",
  sessionId: "abc-123",
};

describe("sessionPageRoute", () => {
  it("reads session pages of this extension and the hosted app only", () => {
    expect(sessionPageRoute(`chrome-extension://${ID}${PATH}`, ID)).toEqual(
      ROUTE,
    );
    expect(
      sessionPageRoute(
        `https://vibeallday.navs.dpdns.org/remote${PATH}?tab=1#x`,
        ID,
      ),
    ).toEqual(ROUTE);
    expect(
      sessionPageRoute(
        `https://latest.vibeallday.navs.dpdns.org${PATH}/files`,
        ID,
      ),
    ).toEqual(ROUTE);
    // Another extension, a lookalike domain, plain http, non-session pages.
    expect(sessionPageRoute(`chrome-extension://other${PATH}`, ID)).toBeNull();
    expect(
      sessionPageRoute(`https://notvibeallday.navs.dpdns.org${PATH}`, ID),
    ).toBeNull();
    expect(
      sessionPageRoute(`http://vibeallday.navs.dpdns.org${PATH}`, ID),
    ).toBeNull();
    expect(
      sessionPageRoute(
        `https://vibeallday.navs.dpdns.org/-/relay/kyle/projects/p`,
        ID,
      ),
    ).toBeNull();
    expect(
      sessionPageRoute(
        `https://artifact-${"a".repeat(32)}.vibeallday.navs.dpdns.org${PATH}`,
        ID,
      ),
    ).toBeNull();
    expect(sessionPageRoute("not a url", ID)).toBeNull();
  });
});
