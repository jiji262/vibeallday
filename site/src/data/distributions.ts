export type DistributionStatus = "available" | "beta" | "development";

export interface PublicDistribution {
  id: string;
  name: string;
  platform: string;
  status: DistributionStatus;
  summary: string;
  docsPath: `/docs/${string}`;
  downloadUrl?: string;
  actionLabel?: string;
  sourceRefs: string[];
}

export const distributions = [
  {
    id: "desktop-macos",
    name: "Desktop for macOS",
    platform: "Apple Silicon and Intel",
    status: "development",
    summary:
      "Desktop app source with the server, client, and runtime bundled. Installers are not published yet.",
    docsPath: "/docs/desktop-apps",
    actionLabel: "Choose installer",
    sourceRefs: [
      "packages/desktop/README.md",
      ".github/workflows/desktop-ci.yml",
    ],
  },
  {
    id: "desktop-windows",
    name: "Desktop for Windows",
    platform: "Windows x64",
    status: "development",
    summary:
      "Desktop app source for Windows. Signed installers are not published yet.",
    docsPath: "/docs/desktop-apps",
    actionLabel: "Choose installer",
    sourceRefs: [
      "packages/desktop/README.md",
      ".github/workflows/desktop-ci.yml",
    ],
  },
  {
    id: "npm",
    name: "npm server install",
    platform: "macOS, Windows, and Linux",
    status: "development",
    summary:
      "Build the command-line server from source. The npm package is not published yet.",
    docsPath: "/docs/install-npm",
    actionLabel: "Build from source",
    sourceRefs: ["README.md", "package.json"],
  },
  {
    id: "mobile-web",
    name: "Mobile browser",
    platform: "Phones and tablets",
    status: "available",
    summary:
      "Use the responsive web client from a browser; no native phone app is required.",
    docsPath: "/docs/remote-access",
    actionLabel: "Connect from a phone",
    sourceRefs: ["README.md", "packages/client/src/remote-main.tsx"],
  },
  {
    id: "native-mobile",
    name: "Android and iOS apps",
    platform: "Android first; iOS later",
    status: "development",
    summary:
      "Android is in development and iOS is planned afterward. Neither is published; use the mobile browser client today.",
    docsPath: "/docs/getting-started",
    sourceRefs: ["packages/android/package.json", "topics/android-fcm-push.md"],
  },
] as const satisfies readonly PublicDistribution[];

export type DistributionId = (typeof distributions)[number]["id"];
