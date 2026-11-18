import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLogQueue } from "../ClientLogQueue";

const queues: ClientLogQueue[] = [];
const entry = (message: string) => ({
  timestamp: 1,
  level: "info",
  prefix: "test",
  message,
});

async function database(version?: number) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("vibeallday-client-logs", version);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("entries", {
        keyPath: "id",
        autoIncrement: true,
      });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openQueue() {
  const queue = new ClientLogQueue();
  queues.push(queue);
  await queue.open();
  return queue;
}

async function clearDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("vibeallday-client-logs");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("queue still open"));
  });
}

describe("source-scoped diagnostic storage", () => {
  beforeEach(clearDatabase);
  afterEach(async () => {
    for (const queue of queues) queue.close();
    queues.length = 0;
    vi.restoreAllMocks();
    await clearDatabase();
  });

  it("shares only matching destinations across tabs and reloads", async () => {
    const tabA = await openQueue();
    const tabB = await openQueue();
    tabA.add("a", entry("private-a"));
    await tabA.take("a");
    expect((await tabB.take("b"))?.entries).toEqual([]);
    tabA.close();
    const batch = await tabB.take("a");
    expect(batch?.entries.map((item) => item.message)).toEqual(["private-a"]);
    await batch?.acknowledge();
    expect((await tabB.take("a"))?.entries).toEqual([]);
  });

  it("discards legacy entries rather than assigning them to a new server", async () => {
    const legacy = await database(2);
    await new Promise<void>((resolve, reject) => {
      const tx = legacy.transaction("entries", "readwrite");
      tx.objectStore("entries").add(entry("unbound-private-log"));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    legacy.close();
    const queue = await openQueue();
    queue.add("b", entry("new-b"));
    expect(
      (await queue.take("b"))?.entries.map((item) => item.message),
    ).toEqual(["new-b"]);
    const upgraded = await database();
    const count = upgraded
      .transaction("entries")
      .objectStore("entries")
      .count();
    await new Promise<void>((resolve) => {
      count.onsuccess = () => resolve();
    });
    expect(count.result).toBe(1);
    upgraded.close();
  });

  it("keeps failed memory batches separated and bounded when IndexedDB is unavailable", async () => {
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const queue = await openQueue();
    queue.add("a", entry("private-a"));
    queue.add("b", entry("private-b"));
    const first = await queue.take("a");
    expect(first?.entries.map((item) => item.message)).toEqual(["private-a"]);
    expect(
      (await queue.take("b"))?.entries.map((item) => item.message),
    ).toEqual(["private-b"]);
    expect((await queue.take("a"))?.entries).toEqual(first?.entries);
    await first?.acknowledge();
    expect((await queue.take("a"))?.entries).toEqual([]);
    for (let i = 0; i < 2100; i++) queue.add("a", entry(`item-${i}`));
    const retained = [];
    for (let i = 0; i < 5; i++) {
      const batch = await queue.take("a");
      retained.push(...(batch?.entries ?? []));
      await batch?.acknowledge();
    }
    expect(retained).toHaveLength(2000);
    expect(retained[0]?.message).toBe("item-100");
    expect((await queue.take("b"))?.entries).toEqual([]);
  });
});
