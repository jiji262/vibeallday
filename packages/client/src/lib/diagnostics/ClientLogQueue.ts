import { countEntries, deleteEntries, getAllEntries, putEntry } from "./idb";

export interface LogEntry {
  id?: number;
  timestamp: number;
  level: string;
  prefix: string;
  message: string;
  tabId?: string;
}

interface ScopedEntry extends LogEntry {
  destination: string;
}
const DB_NAME = "vibeallday-client-logs";
const DB_VERSION = 3;
const STORE = "entries";
const DESTINATION_INDEX = "destination";
const MAX_ENTRIES = 2000;
const BATCH_SIZE = 500;

function openLogDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let rejected = false;
    request.onblocked = () => {
      rejected = true;
      reject(new Error("Client log database upgrade is blocked"));
    };
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE)
        ? request.transaction!.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      // 旧日志没有可信目的地，禁止迁移到任意当前服务器。
      store.clear();
      store.createIndex(DESTINATION_INDEX, "destination");
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (rejected) db.close();
      else resolve(db);
    };
  });
}

async function readBatch(
  db: IDBDatabase,
  destination: string,
): Promise<ScopedEntry[]> {
  const request = db
    .transaction(STORE)
    .objectStore(STORE)
    .index(DESTINATION_INDEX)
    .getAll(destination, BATCH_SIZE);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class ClientLogQueue {
  private db: IDBDatabase | null = null;
  private memory: ScopedEntry[] = [];
  private closed = false;
  private pending: Promise<void> = Promise.resolve();

  open(): Promise<void> {
    this.pending = this.connect();
    return this.pending;
  }

  private async connect(): Promise<void> {
    try {
      const db = await openLogDatabase();
      if (this.closed) {
        db.close();
        return;
      }
      if (
        !db.objectStoreNames.contains(STORE) ||
        !db
          .transaction(STORE)
          .objectStore(STORE)
          .indexNames.contains(DESTINATION_INDEX)
      ) {
        db.close();
        return;
      }
      this.db = db;
    } catch {
      /* 存储不可用时使用同样按目的地隔离的有界内存队列。 */
    }
  }

  close(): void {
    this.closed = true;
    this.db?.close();
    this.db = null;
    this.memory = [];
  }

  add(destination: string, entry: LogEntry): void {
    this.pending = this.pending.then(() =>
      this.persist({ ...entry, destination }),
    );
  }

  async take(destination: string) {
    await this.pending;
    if (this.closed) return null;
    const db = this.db;
    try {
      const entries = db
        ? await readBatch(db, destination)
        : this.memory
            .filter((entry) => entry.destination === destination)
            .slice(0, BATCH_SIZE);
      return {
        entries: entries.map(
          ({ destination: _destination, ...entry }) => entry,
        ),
        acknowledge: async () => {
          if (this.closed) return;
          if (db)
            await deleteEntries(
              db,
              STORE,
              entries.flatMap((entry) =>
                entry.id === undefined ? [] : [entry.id],
              ),
            );
          else {
            const sent = new Set(entries);
            this.memory = this.memory.filter((entry) => !sent.has(entry));
          }
        },
      };
    } catch {
      this.fallback();
      return null;
    }
  }

  private async persist(entry: ScopedEntry): Promise<void> {
    if (this.closed) return;
    const db = this.db;
    if (!db) {
      this.buffer(entry);
      return;
    }
    try {
      await putEntry(db, STORE, entry);
      const count = await countEntries(db, STORE);
      if (count <= MAX_ENTRIES || this.closed) return;
      const oldest = await getAllEntries<ScopedEntry>(
        db,
        STORE,
        count - MAX_ENTRIES,
      );
      await deleteEntries(
        db,
        STORE,
        oldest.flatMap((old) => (old.id === undefined ? [] : [old.id])),
      );
    } catch {
      if (this.closed) return;
      this.fallback();
      this.buffer(entry);
    }
  }

  private fallback(): void {
    this.db?.close();
    this.db = null;
  }

  private buffer(entry: ScopedEntry): void {
    this.memory.push(entry);
    if (this.memory.length > MAX_ENTRIES)
      this.memory.splice(0, this.memory.length - MAX_ENTRIES);
  }
}
