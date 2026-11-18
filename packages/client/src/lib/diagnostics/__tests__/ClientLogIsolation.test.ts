import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  asClientSummarySourceKey,
  resetClientSummaryStoreForTests,
  setCurrentClientSummarySourceKey,
} from "../../clientSummaryStore";
import { SecureConnection } from "../../connection/SecureConnection";
import {
  getSourceRuntimeRegistry,
  resetSourceRuntimeRegistryForTests,
} from "../../sourceRuntime";
import { SecureSourceTransport } from "../../transport";
import { ClientLogCollector } from "../ClientLogCollector";
import { ClientLogQueue } from "../ClientLogQueue";
import { createScopedConsole } from "../scopedConsole";

vi.mock("../../../api/client", () => ({ fetchJSON: vi.fn(async () => ({})) }));
import { fetchJSON } from "../../../api/client";

const collectors: ClientLogCollector[] = [];
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const source = (id: string) => asClientSummarySourceKey(`host:${id}`);

function connection(endpoint: string, identity = "owner") {
  const conn = new SecureConnection(endpoint, identity, "mock-password");
  const fetch = vi.spyOn(conn, "fetch").mockResolvedValue({});
  return { conn, fetch };
}

function register(id: string, endpoint: string, identity = "owner") {
  const peer = connection(endpoint, identity);
  const transport = new SecureSourceTransport();
  transport.attach(peer.conn);
  getSourceRuntimeRegistry().registerSourceTransport(source(id), {
    kind: "custom",
    createTransport: () => transport,
  });
  return { ...peer, transport };
}

async function start(id: string) {
  setCurrentClientSummarySourceKey(source(id));
  const collector = new ClientLogCollector();
  collectors.push(collector);
  await collector.start();
  await settle();
  return collector;
}

function messages(fetch: ReturnType<typeof vi.fn>) {
  return fetch.mock.calls.flatMap((call) =>
    JSON.parse(call[1]?.body as string).entries.map(
      (entry: { message: string }) => entry.message,
    ),
  );
}

async function deleteDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("vibeallday-client-logs");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("log database still open"));
  });
}

describe("diagnostic destination isolation", () => {
  beforeEach(async () => {
    await deleteDatabase();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetClientSummaryStoreForTests();
    resetSourceRuntimeRegistryForTests();
    vi.mocked(fetchJSON).mockClear();
  });

  afterEach(async () => {
    for (const collector of collectors.reverse()) collector.stop();
    collectors.length = 0;
    resetSourceRuntimeRegistryForTests();
    resetClientSummaryStoreForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await deleteDatabase();
  });

  it("keeps persisted A logs away from B and delivers them after returning to A", async () => {
    const a = register("a", "ws://a.invalid/ws");
    const b = register("b", "ws://b.invalid/ws");
    const collector = await start("a");
    collector.record("info", "test", "private-a");
    await settle();
    setCurrentClientSummarySourceKey(source("b"));
    collector.record("info", "test", "private-b");
    await settle();
    await collector.flush();
    expect(messages(b.fetch)).toContain("private-b");
    expect(messages(b.fetch)).not.toContain("private-a");
    setCurrentClientSummarySourceKey(source("a"));
    await collector.flush();
    expect(messages(a.fetch)).toContain("private-a");
    expect(messages(a.fetch)).not.toContain("private-b");
    expect(fetchJSON).not.toHaveBeenCalled();
  });

  it.each([
    { endpoint: "ws://b.invalid/ws", identity: "owner" },
    { endpoint: "ws://a.invalid/ws", identity: "other-owner" },
  ])(
    "does not reassign an existing source queue to $endpoint / $identity",
    async ({ endpoint, identity }) => {
      const a = register("same", "ws://a.invalid/ws");
      const collector = await start("same");
      collector.record("info", "test", "old-principal");
      await settle();
      const b = connection(endpoint, identity);
      a.transport.attach(b.conn);
      collector.record("info", "test", "new-principal");
      await settle();
      await collector.flush();
      expect(messages(b.fetch)).toContain("new-principal");
      expect(messages(b.fetch)).not.toContain("old-principal");
      a.transport.attach(a.conn);
      await collector.flush();
      expect(messages(a.fetch)).toContain("old-principal");
    },
  );

  it("ignores late work from a stopped collection after restarting on B", async () => {
    const a = register("a", "ws://a.invalid/ws");
    const b = register("b", "ws://b.invalid/ws");
    const collector = await start("a");
    const stale = collector.captureRecorder();
    a.fetch.mockClear();
    let resolve!: (value: object) => void;
    a.fetch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    collector.record("info", "test", "in-flight-a");
    const oldFlush = collector.flush();
    await vi.waitFor(() => expect(a.fetch).toHaveBeenCalledTimes(1));
    collector.stop();
    setCurrentClientSummarySourceKey(source("b"));
    await collector.start();
    stale?.record("info", "test", "late-a");
    collector.record("info", "test", "new-b");
    resolve({});
    await oldFlush;
    await collector.flush();
    expect(messages(b.fetch)).toContain("new-b");
    expect(messages(b.fetch)).not.toContain("in-flight-a");
    expect(messages(b.fetch)).not.toContain("late-a");
  });

  it("keeps a failed in-flight batch with A while B makes progress", async () => {
    const a = register("a", "ws://a.invalid/ws");
    const b = register("b", "ws://b.invalid/ws");
    const collector = await start("a");
    a.fetch.mockClear();
    let reject!: (reason: Error) => void;
    a.fetch.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    collector.record("info", "test", "failed-private-a");
    const flushA = collector.flush();
    await vi.waitFor(() => expect(a.fetch).toHaveBeenCalledTimes(1));
    setCurrentClientSummarySourceKey(source("b"));
    collector.record("info", "test", "private-b");
    const flushB = collector.flush();
    reject(new Error("offline"));
    await Promise.all([flushA, flushB]);
    expect(messages(b.fetch)).toContain("private-b");
    expect(messages(b.fetch)).not.toContain("failed-private-a");
    setCurrentClientSummarySourceKey(source("a"));
    await collector.flush();
    expect(
      messages(a.fetch).filter((message) => message === "failed-private-a"),
    ).toHaveLength(2);
  });

  it("rechecks the destination after an asynchronous queue read", async () => {
    const a = register("a", "ws://a.invalid/ws");
    const b = register("b", "ws://b.invalid/ws");
    const collector = await start("a");
    collector.record("info", "test", "private-before-read");
    const take = ClientLogQueue.prototype.take;
    vi.spyOn(ClientLogQueue.prototype, "take").mockImplementationOnce(
      async function (this: ClientLogQueue, key) {
        const batch = await take.call(this, key);
        setCurrentClientSummarySourceKey(source("b"));
        return batch;
      },
    );
    await collector.flush();
    expect(messages(a.fetch)).not.toContain("private-before-read");
    expect(messages(b.fetch)).not.toContain("private-before-read");
    setCurrentClientSummarySourceKey(source("a"));
    await collector.flush();
    expect(messages(a.fetch)).toContain("private-before-read");
  });

  it("keeps background and unscoped console output away from a remote server", async () => {
    const a = register("a", "ws://a.invalid/ws");
    const b = register("b", "ws://b.invalid/ws");
    const collector = await start("b");
    a.fetch.mockRestore();
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor() {
          throw new Error("mock offline");
        }
      },
    );
    await expect(a.conn.fetch("/test")).rejects.toThrow("mock offline");
    createScopedConsole(() => a.conn.getDiagnosticScope()).log(
      "[SecureConnection] ws://private-a.invalid/ws",
    );
    createScopedConsole(() => b.conn.getDiagnosticScope()).warn(
      "[SecureConnection] active-b",
    );
    console.error("unscoped-private-error");
    await collector.flush();
    expect(messages(b.fetch).join()).not.toContain("private-a.invalid");
    expect(messages(b.fetch).join()).not.toContain(
      "Connecting to ws://a.invalid",
    );
    expect(messages(b.fetch).join()).not.toContain("unscoped-private-error");
    expect(messages(b.fetch).join()).toContain("active-b");
  });

  it("does not forward a global route left over from another source", async () => {
    const before = window.location.href;
    const b = register("b", "ws://b.invalid/ws");
    try {
      window.history.replaceState(
        {},
        "",
        "/private-a-project/private-a-session",
      );
      const collector = await start("b");
      await collector.flush();
      expect(messages(b.fetch).join()).not.toContain("private-a-project");
      expect(messages(b.fetch).join()).toContain("ClientTelemetry");
    } finally {
      window.history.replaceState({}, "", before);
    }
  });

  it("does not assign a background resume observation to the current server", async () => {
    register("a", "ws://a.invalid/ws");
    const b = register("b", "ws://b.invalid/ws");
    const collector = await start("b");
    const event = {
      attemptId: "attempt-a",
      sessionId: "private-session-a",
      mode: "direct" as const,
      endpoint: "ws://a.invalid/ws",
      identity: "owner",
      phase: "connecting",
      event: "started" as const,
      at: 1,
      elapsedMs: 0,
      clientVersion: "mock",
    };
    collector.recordResumeObservation(event);
    collector.recordResumeObservation({
      ...event,
      endpoint: "ws://b.invalid/ws",
      sessionId: "private-session-b",
    });
    await collector.flush();
    expect(messages(b.fetch).join()).not.toContain("private-session-a");
    expect(messages(b.fetch).join()).toContain("private-session-b");
  });
});
