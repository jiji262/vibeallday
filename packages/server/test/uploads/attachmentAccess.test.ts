import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeManagedAttachmentPath } from "../../src/uploads/attachmentAccess.js";

const dataDir = "/home/me/.vibeallday";
const attachment = join(
  dataDir,
  "projects",
  "0123456789abcdef0123456789abcdef",
  "attachments",
  "session-a",
  "photo.png",
);

describe("canonicalizeManagedAttachmentPath", () => {
  it("accepts app-data project attachments", () => {
    expect(canonicalizeManagedAttachmentPath(attachment, dataDir)).toBe(
      resolve(attachment),
    );
  });

  it("accepts a home-relative attachment path", () => {
    const home = homedir();
    const localDataDir = join(home, ".vibeallday");
    const homeAttachment = join(
      localDataDir,
      "projects",
      "0123456789abcdef0123456789abcdef",
      "attachments",
      "session-a",
      "photo.png",
    );
    expect(
      canonicalizeManagedAttachmentPath(
        `~/.vibeallday/projects/0123456789abcdef0123456789abcdef/attachments/session-a/photo.png`,
        localDataDir,
      ),
    ).toBe(resolve(homeAttachment));
  });

  it("rejects other app-data project files", () => {
    expect(
      canonicalizeManagedAttachmentPath(
        join(
          dataDir,
          "projects",
          "0123456789abcdef0123456789abcdef",
          "meta.json",
        ),
        dataDir,
      ),
    ).toBeNull();
  });

  it("rejects arbitrary absolute paths", () => {
    expect(
      canonicalizeManagedAttachmentPath("/etc/passwd", dataDir),
    ).toBeNull();
  });
});
