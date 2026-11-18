import { statSync } from "node:fs";
import { createRequire } from "node:module";
import type {
  OpenCodeMessage,
  OpenCodeSessionEntry,
  OpenCodeStoredPart,
} from "@vibeallday/shared";

/**
 * Direct reader for OpenCode's SQLite transcript store (`opencode.db`, 1.16+ and 2.x).
 *
 * OpenCode 1.16+ persists every session in a single SQLite database (`project`,
 * `session`, `message`, `part`), while OpenCode 2.x also uses the event-sourced
 * projection (`session_v2` or `session` with a `directory` column +
 * `session_message` + optional `session_part`/`part`). Reading the DB directly
 * is the authoritative, subprocess-free durable source. See
 * `topics/opencode-backend.md` § "Durable Storage Format".
 *
 * Contract: open **read-only**, never write/checkpoint/PRAGMA-mutate; tolerate a
 * concurrent `opencode serve` writer (WAL readers see the latest committed
 * snapshot per statement); and **never throw** out of a public method — any
 * absence/lock/old-schema returns null so callers fall through to the export and
 * file-tree readers.
 *
 * Mechanism: Node's built-in `node:sqlite` (Node >= 22.5), loaded via a guarded
 * dynamic import so older runtimes (the package targets node >= 20) degrade to
 * the fallbacks rather than crashing — and so the published package keeps its
 * zero-native-dependency property (no `better-sqlite3` build per install).
 */

/** Minimal structural view of the `node:sqlite` API we use (read-only). */
interface SqliteStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  close(): void;
}
type SqliteCtor = new (
  path: string,
  options?: { readOnly?: boolean },
) => SqliteDatabase;

const nodeRequire = createRequire(import.meta.url);
let sqliteCtor: SqliteCtor | null | undefined;

const DIRECTORY_PROJECT_ID_PREFIX = "dir:";

/**
 * Resolve the `node:sqlite` `DatabaseSync` constructor once, or null when the
 * runtime lacks it (Node < 22.5).
 */
function loadSqliteCtor(): SqliteCtor | null {
  if (sqliteCtor === undefined) {
    try {
      sqliteCtor =
        (nodeRequire("node:sqlite") as { DatabaseSync?: SqliteCtor })
          .DatabaseSync ?? null;
    } catch {
      sqliteCtor = null;
    }
  }
  return sqliteCtor;
}

/**
 * Global opt-out for the direct opencode.db reader (default **on**). Set
 * `OPENCODE_DB_READER=0` (or `false`/`off`/`no`) to disable it.
 */
function openCodeDbReaderEnabled(): boolean {
  const v = process.env.OPENCODE_DB_READER?.trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

/** Session-level metadata read straight from the `session` / `session_v2` row. */
export interface OpenCodeDbSessionRow {
  id: string;
  title: string | null;
  /** Parsed `session.model` JSON; carries both providerID and the model id. */
  model: { id?: string; providerID?: string; modelID?: string } | null;
  timeCreated: number | null;
  timeUpdated: number | null;
  /** Number of `message` / `session_message` rows for the session (full count). */
  messageCount: number;
}

/** One install-wide session row, already joined to its project's worktree. */
export interface OpenCodeDbCatalogRow {
  id: string;
  worktree: string;
  title: string | null;
  timeCreated: number | null;
  timeUpdated: number | null;
}

/** Child session keyed by `parent_id` (OpenCode task / subagent). */
export interface OpenCodeDbChildSessionRow {
  id: string;
  parentId: string;
  title: string | null;
  agent: string | null;
  timeUpdated: number | null;
}

interface DbRow {
  [column: string]: unknown;
}

interface DbSchemaInfo {
  hasProject: boolean;
  hasSession: boolean;
  hasSessionV2: boolean;
  hasMessage: boolean;
  hasSessionMessage: boolean;
  hasPart: boolean;
  hasSessionPart: boolean;
  sessionColumns: Set<string>;
  sessionV2Columns: Set<string>;
}

type SessionTableSpec = {
  name: "session" | "session_v2";
  columns: Set<string>;
};

export class OpenCodeDbReader {
  private db: SqliteDatabase | null | undefined = undefined;
  /** inode+mtime of the db file at open, to reopen if the file is replaced. */
  private dbStamp: string | undefined;
  /** worktree -> project.id or synthetic `dir:<worktree>` (or null when absent). */
  private projectIdCache = new Map<string, string | null>();
  /** Cached table/column layout; reset when the handle reopens. */
  private schema: DbSchemaInfo | undefined;

  constructor(private databasePath: string) {}

  /**
   * Lazily open (and cache) a read-only handle. Re-stats the db file so a
   * replaced database (different inode/mtime) reopens rather than reading a
   * stale handle. Returns null when the file is absent or sqlite is unavailable.
   */
  private ensureDb(): SqliteDatabase | null {
    if (!openCodeDbReaderEnabled()) return null;

    let stamp: string;
    try {
      const st = statSync(this.databasePath);
      stamp = `${st.ino}:${st.mtimeMs}:${st.size}`;
    } catch {
      this.closeHandle();
      return null;
    }

    if (this.db && this.dbStamp === stamp) return this.db;
    if (this.db && this.dbStamp !== stamp) this.closeHandle();

    const Ctor = loadSqliteCtor();
    if (!Ctor) {
      this.db = null;
      return null;
    }
    try {
      this.db = new Ctor(this.databasePath, { readOnly: true });
      this.dbStamp = stamp;
      return this.db;
    } catch {
      this.db = null;
      this.dbStamp = undefined;
      return null;
    }
  }

  private closeHandle(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
    }
    this.db = undefined;
    this.dbStamp = undefined;
    this.schema = undefined;
    this.projectIdCache.clear();
  }

  private getSchema(db: SqliteDatabase): DbSchemaInfo {
    if (this.schema) return this.schema;

    const tableRows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('project', 'session', 'session_v2', 'message', 'session_message', 'part', 'session_part')",
      )
      .all() as DbRow[];
    const tables = new Set<string>();
    for (const row of tableRows) {
      if (typeof row.name === "string") tables.add(row.name);
    }

    const readCols = (table: string): Set<string> => {
      if (!tables.has(table)) return new Set();
      try {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as DbRow[];
        return new Set(
          cols
            .map((col) => col.name)
            .filter((name): name is string => typeof name === "string"),
        );
      } catch {
        return new Set();
      }
    };

    this.schema = {
      hasProject: tables.has("project"),
      hasSession: tables.has("session"),
      hasSessionV2: tables.has("session_v2"),
      hasMessage: tables.has("message"),
      hasSessionMessage: tables.has("session_message"),
      hasPart: tables.has("part"),
      hasSessionPart: tables.has("session_part"),
      sessionColumns: readCols("session"),
      sessionV2Columns: readCols("session_v2"),
    };
    return this.schema;
  }

  private directorySessionTables(schema: DbSchemaInfo): SessionTableSpec[] {
    const out: SessionTableSpec[] = [];
    if (schema.hasSessionV2 && schema.sessionV2Columns.has("directory")) {
      out.push({ name: "session_v2", columns: schema.sessionV2Columns });
    }
    if (schema.hasSession && schema.sessionColumns.has("directory")) {
      out.push({ name: "session", columns: schema.sessionColumns });
    }
    return out;
  }

  /** project.id (1.16+) or `dir:<worktree>` (2.x) for a worktree path, cached. */
  async getProjectId(worktree: string): Promise<string | null> {
    const cached = this.projectIdCache.get(worktree);
    if (cached !== undefined) return cached;

    const resolved = await this.run((db) => {
      const schema = this.getSchema(db);
      if (schema.hasProject) {
        const row = db
          .prepare("SELECT id FROM project WHERE worktree = ?")
          .get(worktree) as DbRow | undefined;
        if (typeof row?.id === "string") return row.id;
      }

      if (!schema.hasMessage && !schema.hasSessionMessage) {
        return null;
      }

      for (const table of this.directorySessionTables(schema)) {
        const row = db
          .prepare(
            `SELECT 1 AS ok FROM ${table.name} WHERE directory = ? LIMIT 1`,
          )
          .get(worktree) as DbRow | undefined;
        if (row) {
          return `${DIRECTORY_PROJECT_ID_PREFIX}${worktree}`;
        }
      }
      return null;
    });
    const value = resolved ?? null;
    this.projectIdCache.set(worktree, value);
    return value;
  }

  /**
   * Session row scoped to its project (mirrors the export path's
   * project-belonging check). Null when the session isn't in this project, the
   * DB is unusable, or the schema predates the SQLite transcript store.
   */
  async getSessionRow(
    sessionId: string,
    projectId: string,
  ): Promise<OpenCodeDbSessionRow | null> {
    return this.run((db) => {
      const schema = this.getSchema(db);
      if (!schema.hasMessage && !schema.hasSessionMessage) return null;

      let row: DbRow | undefined;
      if (projectId.startsWith(DIRECTORY_PROJECT_ID_PREFIX)) {
        const worktree = projectId.slice(DIRECTORY_PROJECT_ID_PREFIX.length);
        for (const table of this.directorySessionTables(schema)) {
          row = db
            .prepare(
              `SELECT ${selectSessionCols(table.columns)} FROM ${table.name} WHERE id = ? AND directory = ?`,
            )
            .get(sessionId, worktree) as DbRow | undefined;
          if (row && typeof row.id === "string") break;
        }
      } else if (schema.hasSession && schema.sessionColumns.has("project_id")) {
        row = db
          .prepare(
            `SELECT ${selectSessionCols(schema.sessionColumns)} FROM session WHERE id = ? AND project_id = ?`,
          )
          .get(sessionId, projectId) as DbRow | undefined;
      }
      if (!row || typeof row.id !== "string") return null;

      let messageCount = 0;
      if (schema.hasMessage) {
        const count = db
          .prepare("SELECT count(*) AS c FROM message WHERE session_id = ?")
          .get(sessionId) as DbRow | undefined;
        messageCount = numberOrNull(count?.c) ?? 0;
      }
      if (messageCount === 0 && schema.hasSessionMessage) {
        const count = db
          .prepare(
            "SELECT count(*) AS c FROM session_message WHERE session_id = ? AND type IN ('user', 'assistant')",
          )
          .get(sessionId) as DbRow | undefined;
        messageCount = numberOrNull(count?.c) ?? 0;
      }

      let model = parseModel(row.model);
      let timeCreated = numberOrNull(row.time_created);
      let timeUpdated = numberOrNull(row.time_updated);

      if (
        schema.hasSessionMessage &&
        (model === null || timeCreated === null || timeUpdated === null)
      ) {
        const stats = this.readSessionMessageRollup(db, sessionId);
        if (model === null) model = stats.model;
        if (timeCreated === null) timeCreated = stats.timeCreated;
        if (timeUpdated === null) timeUpdated = stats.timeUpdated;
      }

      return {
        id: row.id,
        title: typeof row.title === "string" ? row.title : null,
        model,
        timeCreated,
        timeUpdated,
        messageCount,
      };
    });
  }

  private readSessionMessageRollup(
    db: SqliteDatabase,
    sessionId: string,
  ): {
    model: OpenCodeDbSessionRow["model"];
    timeCreated: number | null;
    timeUpdated: number | null;
  } {
    const times = db
      .prepare(
        `SELECT
          MIN(coalesce(json_extract(data, '$.time.created'), time_created)) AS min_created,
          MAX(coalesce(json_extract(data, '$.time.completed'), json_extract(data, '$.time.created'), time_created)) AS max_updated
        FROM session_message
        WHERE session_id = ? AND type IN ('user', 'assistant')`,
      )
      .get(sessionId) as DbRow | undefined;

    const lastModelRow = db
      .prepare(
        `SELECT data FROM session_message
         WHERE session_id = ? AND type = 'assistant'
         ORDER BY id DESC LIMIT 10`,
      )
      .all(sessionId) as DbRow[];

    let model: OpenCodeDbSessionRow["model"] = null;
    for (const row of lastModelRow) {
      const parsed = parseJson(row.data);
      model = extractModelFromMessageData(parsed);
      if (model) break;
    }

    return {
      model,
      timeCreated: numberOrNull(times?.min_created),
      timeUpdated: numberOrNull(times?.max_updated),
    };
  }

  /** Lightweight freshness probe: latest `time_updated` + message count. */
  async getSessionMeta(
    sessionId: string,
    projectId: string,
  ): Promise<{ timeUpdated: number; messageCount: number } | null> {
    const row = await this.getSessionRow(sessionId, projectId);
    if (!row) return null;
    return {
      timeUpdated: row.timeUpdated ?? 0,
      messageCount: row.messageCount,
    };
  }

  /** All sessions for a project (id + updated time), for enumeration. */
  async listSessionRows(
    projectId: string,
  ): Promise<{ id: string; timeUpdated: number }[]> {
    return (
      (await this.run((db) => {
        const schema = this.getSchema(db);
        const out: { id: string; timeUpdated: number }[] = [];
        const seen = new Set<string>();

        if (projectId.startsWith(DIRECTORY_PROJECT_ID_PREFIX)) {
          const worktree = projectId.slice(DIRECTORY_PROJECT_ID_PREFIX.length);
          for (const table of this.directorySessionTables(schema)) {
            const timeExpr = table.columns.has("time_updated")
              ? "s.time_updated"
              : "NULL";
            const sql = schema.hasSessionMessage
              ? `SELECT s.id AS id, coalesce(${timeExpr}, (SELECT MAX(coalesce(json_extract(m.data, '$.time.completed'), json_extract(m.data, '$.time.created'), m.time_created)) FROM session_message m WHERE m.session_id = s.id)) AS time_updated FROM ${table.name} s WHERE s.directory = ? ORDER BY time_updated DESC`
              : `SELECT s.id AS id, ${timeExpr} AS time_updated FROM ${table.name} s WHERE s.directory = ? ORDER BY time_updated DESC`;
            const rows = db.prepare(sql).all(worktree) as DbRow[];
            for (const row of rows) {
              if (typeof row.id === "string" && !seen.has(row.id)) {
                seen.add(row.id);
                out.push({
                  id: row.id,
                  timeUpdated: numberOrNull(row.time_updated) ?? 0,
                });
              }
            }
          }
          out.sort((a, b) => b.timeUpdated - a.timeUpdated);
          return out;
        }

        if (schema.hasSession && schema.sessionColumns.has("project_id")) {
          const rows = db
            .prepare(
              "SELECT id, time_updated FROM session WHERE project_id = ? ORDER BY time_updated DESC",
            )
            .all(projectId) as DbRow[];
          for (const row of rows) {
            if (typeof row.id === "string") {
              out.push({
                id: row.id,
                timeUpdated: numberOrNull(row.time_updated) ?? 0,
              });
            }
          }
        }
        return out;
      })) ?? []
    );
  }

  /**
   * Every session in the store, joined to its project's worktree, in one
   * pass across 1.16 (`session JOIN project`) and 2.x (`session_v2`/`session.directory`).
   */
  async listAllSessionRows(): Promise<OpenCodeDbCatalogRow[]> {
    return (
      (await this.run((db) => {
        const schema = this.getSchema(db);
        const out: OpenCodeDbCatalogRow[] = [];
        const seen = new Set<string>();

        if (
          schema.hasSession &&
          schema.hasProject &&
          schema.sessionColumns.has("project_id")
        ) {
          const rows = db
            .prepare(
              "SELECT s.id AS id, s.title AS title, s.time_created AS time_created, s.time_updated AS time_updated, p.worktree AS worktree FROM session s JOIN project p ON p.id = s.project_id",
            )
            .all() as DbRow[];
          for (const row of rows) {
            if (typeof row.id !== "string" || seen.has(row.id)) continue;
            if (typeof row.worktree !== "string" || row.worktree.length === 0) {
              continue;
            }
            seen.add(row.id);
            out.push({
              id: row.id,
              worktree: row.worktree,
              title: typeof row.title === "string" ? row.title : null,
              timeCreated: numberOrNull(row.time_created),
              timeUpdated: numberOrNull(row.time_updated),
            });
          }
        }

        for (const table of this.directorySessionTables(schema)) {
          const titleExpr = table.columns.has("title") ? "s.title" : "NULL";
          const createdExpr = table.columns.has("time_created")
            ? "s.time_created"
            : "NULL";
          const updatedExpr = table.columns.has("time_updated")
            ? "s.time_updated"
            : "NULL";
          const sql = schema.hasSessionMessage
            ? `SELECT s.id AS id, s.directory AS worktree, ${titleExpr} AS title,
                 coalesce(${createdExpr}, (SELECT MIN(coalesce(json_extract(m.data, '$.time.created'), m.time_created)) FROM session_message m WHERE m.session_id = s.id)) AS time_created,
                 coalesce(${updatedExpr}, (SELECT MAX(coalesce(json_extract(m.data, '$.time.completed'), json_extract(m.data, '$.time.created'), m.time_created)) FROM session_message m WHERE m.session_id = s.id)) AS time_updated
               FROM ${table.name} s
               WHERE s.directory IS NOT NULL AND s.directory != ''`
            : `SELECT s.id AS id, s.directory AS worktree, ${titleExpr} AS title, ${createdExpr} AS time_created, ${updatedExpr} AS time_updated
               FROM ${table.name} s
               WHERE s.directory IS NOT NULL AND s.directory != ''`;
          const rows = db.prepare(sql).all() as DbRow[];
          for (const row of rows) {
            if (typeof row.id !== "string" || seen.has(row.id)) continue;
            if (typeof row.worktree !== "string" || row.worktree.length === 0) {
              continue;
            }
            seen.add(row.id);
            out.push({
              id: row.id,
              worktree: row.worktree,
              title: typeof row.title === "string" ? row.title : null,
              timeCreated: numberOrNull(row.time_created),
              timeUpdated: numberOrNull(row.time_updated),
            });
          }
        }

        return out;
      })) ?? []
    );
  }

  /**
   * Child `ses_*` rows for one parent. Empty when the schema predates
   * `parent_id` or the parent has no children. Does not read message/part rows.
   */
  async listChildSessionRows(
    projectId: string,
    parentSessionId: string,
  ): Promise<OpenCodeDbChildSessionRow[]> {
    return (
      (await this.run((db) => {
        const schema = this.getSchema(db);
        if (projectId.startsWith(DIRECTORY_PROJECT_ID_PREFIX)) {
          const worktree = projectId.slice(DIRECTORY_PROJECT_ID_PREFIX.length);
          const out: OpenCodeDbChildSessionRow[] = [];
          for (const table of this.directorySessionTables(schema)) {
            if (!table.columns.has("parent_id")) continue;
            const titleCol = table.columns.has("title")
              ? "title"
              : "NULL AS title";
            const agentCol = table.columns.has("agent")
              ? "agent"
              : "NULL AS agent";
            const updatedCol = table.columns.has("time_updated")
              ? "time_updated"
              : "NULL AS time_updated";
            const rows = db
              .prepare(
                `SELECT id, parent_id, ${titleCol}, ${agentCol}, ${updatedCol} FROM ${table.name} WHERE directory = ? AND parent_id = ?`,
              )
              .all(worktree, parentSessionId) as DbRow[];
            out.push(...parseChildSessionRows(rows));
          }
          return out;
        }

        if (!schema.hasSession || !schema.sessionColumns.has("parent_id")) {
          return [];
        }
        const rows = db
          .prepare(
            "SELECT id, parent_id, title, agent, time_updated FROM session WHERE project_id = ? AND parent_id = ?",
          )
          .all(projectId, parentSessionId) as DbRow[];
        return parseChildSessionRows(rows);
      })) ?? []
    );
  }

  /**
   * Every child session id in the store. Used to keep `parent_id` rows out of
   * top-level catalogs. Empty when `parent_id` is absent.
   */
  async listChildSessionIds(projectId?: string): Promise<string[]> {
    return (
      (await this.run((db) => {
        const schema = this.getSchema(db);
        const ids = new Set<string>();

        if (projectId?.startsWith(DIRECTORY_PROJECT_ID_PREFIX)) {
          const worktree = projectId.slice(DIRECTORY_PROJECT_ID_PREFIX.length);
          for (const table of this.directorySessionTables(schema)) {
            if (!table.columns.has("parent_id")) continue;
            const rows = db
              .prepare(
                `SELECT id FROM ${table.name} WHERE directory = ? AND parent_id IS NOT NULL AND parent_id != ''`,
              )
              .all(worktree) as DbRow[];
            for (const row of rows) {
              if (typeof row.id === "string") ids.add(row.id);
            }
          }
          return [...ids];
        }

        if (schema.hasSession && schema.sessionColumns.has("parent_id")) {
          const rows = (
            projectId && schema.sessionColumns.has("project_id")
              ? db
                  .prepare(
                    "SELECT id FROM session WHERE project_id = ? AND parent_id IS NOT NULL AND parent_id != ''",
                  )
                  .all(projectId)
              : db
                  .prepare(
                    "SELECT id FROM session WHERE parent_id IS NOT NULL AND parent_id != ''",
                  )
                  .all()
          ) as DbRow[];
          for (const row of rows) {
            if (typeof row.id === "string") ids.add(row.id);
          }
        }

        if (!projectId) {
          for (const table of this.directorySessionTables(schema)) {
            if (!table.columns.has("parent_id")) continue;
            const rows = db
              .prepare(
                `SELECT id FROM ${table.name} WHERE parent_id IS NOT NULL AND parent_id != ''`,
              )
              .all() as DbRow[];
            for (const row of rows) {
              if (typeof row.id === "string") ids.add(row.id);
            }
          }
        }

        return [...ids];
      })) ?? []
    );
  }

  /**
   * Parent `task` parts that name a child session. Session-detail only — list
   * attach must not call this.
   */
  async listTaskChildMappings(
    parentSessionId: string,
  ): Promise<{ toolUseId: string; agentId: string }[]> {
    return (
      (await this.run((db) => {
        const schema = this.getSchema(db);
        const partTable = schema.hasPart
          ? "part"
          : schema.hasSessionPart
            ? "session_part"
            : null;
        if (!partTable) return [];

        let rows: DbRow[];
        try {
          rows = db
            .prepare(
              `SELECT id, data FROM ${partTable} WHERE session_id = ? AND json_extract(data, '$.tool') = 'task'`,
            )
            .all(parentSessionId) as DbRow[];
        } catch {
          rows = db
            .prepare(`SELECT id, data FROM ${partTable} WHERE session_id = ?`)
            .all(parentSessionId) as DbRow[];
        }
        const mappings: { toolUseId: string; agentId: string }[] = [];
        const seen = new Set<string>();
        for (const row of rows) {
          const part = parseJson(row.data);
          if (part?.tool !== "task") continue;
          const agentId = childSessionIdFromTaskPart(part);
          if (!agentId) continue;
          const toolUseIds = [stringOrNull(part.callID), stringOrNull(row.id)];
          for (const toolUseId of toolUseIds) {
            if (!toolUseId) continue;
            const key = `${toolUseId}\0${agentId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            mappings.push({ toolUseId, agentId });
          }
        }
        return mappings;
      })) ?? []
    );
  }

  /** First user message's first text part — the title fallback. */
  async loadFirstUserText(sessionId: string): Promise<string | null> {
    return this.run((db) => {
      const schema = this.getSchema(db);
      const partTable = schema.hasPart
        ? "part"
        : schema.hasSessionPart
          ? "session_part"
          : null;

      if (schema.hasMessage && partTable) {
        const messages = db
          .prepare(
            "SELECT id, data FROM message WHERE session_id = ? ORDER BY id LIMIT 10",
          )
          .all(sessionId) as DbRow[];
        for (const m of messages) {
          const info = parseJson(m.data);
          if (info?.role !== "user") continue;
          const messageId = m.id;
          if (typeof messageId !== "string") continue;
          const parts = db
            .prepare(
              `SELECT data FROM ${partTable} WHERE message_id = ? ORDER BY id`,
            )
            .all(messageId) as DbRow[];
          for (const p of parts) {
            const part = parseJson(p.data);
            if (
              part?.type === "text" &&
              typeof part.text === "string" &&
              part.text.trim()
            ) {
              return part.text.trim();
            }
          }
          return null;
        }
      }

      if (schema.hasSessionMessage) {
        const messages = db
          .prepare(
            "SELECT id, data FROM session_message WHERE session_id = ? AND type = 'user' ORDER BY coalesce(time_created, json_extract(data, '$.time.created'), 0) ASC, id ASC LIMIT 10",
          )
          .all(sessionId) as DbRow[];
        for (const m of messages) {
          const messageId = typeof m.id === "string" ? m.id : null;
          if (partTable && messageId) {
            const parts = db
              .prepare(
                `SELECT data FROM ${partTable} WHERE message_id = ? ORDER BY id`,
              )
              .all(messageId) as DbRow[];
            for (const p of parts) {
              const part = parseJson(p.data);
              if (
                part?.type === "text" &&
                typeof part.text === "string" &&
                part.text.trim()
              ) {
                return part.text.trim();
              }
            }
          }
          const info = parseJson(m.data);
          const inlineText = extractFirstInlineText(info);
          if (inlineText) return inlineText;
        }
      }
      return null;
    });
  }

  /** Tokens from the most recent assistant message (current context fill). */
  async loadLastAssistantTokens(
    sessionId: string,
  ): Promise<OpenCodeMessage["tokens"] | null> {
    return this.run((db) => {
      const schema = this.getSchema(db);
      if (schema.hasMessage) {
        const messages = db
          .prepare(
            "SELECT data FROM message WHERE session_id = ? ORDER BY id DESC LIMIT 30",
          )
          .all(sessionId) as DbRow[];
        for (const m of messages) {
          const info = parseJson(m.data);
          if (info?.role !== "assistant") continue;
          const tokens = info.tokens;
          if (tokens && typeof tokens === "object") {
            return tokens as OpenCodeMessage["tokens"];
          }
        }
      }

      if (schema.hasSessionMessage) {
        const messages = db
          .prepare(
            "SELECT data FROM session_message WHERE session_id = ? AND type = 'assistant' ORDER BY coalesce(time_created, json_extract(data, '$.time.created'), 0) DESC, id DESC LIMIT 30",
          )
          .all(sessionId) as DbRow[];
        for (const m of messages) {
          const info = parseJson(m.data);
          const tokens = info?.tokens;
          if (tokens && typeof tokens === "object") {
            return tokens as OpenCodeMessage["tokens"];
          }
        }
      }
      return null;
    });
  }

  /**
   * Full `{ message, parts }` entries for a session in chronological order, with
   * column ids injected. `afterMessageId` pages: only messages strictly after
   * that id are returned. Null = session unreadable / DB lacks part bodies so
   * callers can fall through to CLI export.
   */
  async loadEntries(
    sessionId: string,
    afterMessageId?: string,
  ): Promise<OpenCodeSessionEntry[] | null> {
    return this.run((db) => {
      const schema = this.getSchema(db);
      const partTable = schema.hasPart
        ? "part"
        : schema.hasSessionPart
          ? "session_part"
          : null;

      if (schema.hasMessage && schema.hasPart) {
        const messageRows = db
          .prepare(
            "SELECT id, data FROM message WHERE session_id = ? ORDER BY id",
          )
          .all(sessionId) as DbRow[];
        if (messageRows.length > 0 || !schema.hasSessionMessage) {
          const partsByMessage = this.loadPartsByMessage(db, "part", sessionId);
          const entries: OpenCodeSessionEntry[] = [];
          let found = !afterMessageId;
          for (const row of messageRows) {
            const messageId = row.id;
            if (typeof messageId !== "string") continue;
            if (!found) {
              if (messageId === afterMessageId) found = true;
              continue;
            }
            const message = asMessage(row.data, messageId, sessionId);
            if (!message) continue;
            entries.push({
              message,
              parts: partsByMessage.get(messageId) ?? [],
            });
          }
          return entries;
        }
      }

      if (schema.hasSessionMessage) {
        const messageRows = db
          .prepare(
            "SELECT id, type, time_created, data FROM session_message WHERE session_id = ? AND type IN ('user', 'assistant') ORDER BY coalesce(time_created, json_extract(data, '$.time.created'), 0) ASC, id ASC",
          )
          .all(sessionId) as DbRow[];
        const partsByMessage = partTable
          ? this.loadPartsByMessage(db, partTable, sessionId)
          : new Map<string, OpenCodeStoredPart[]>();

        let sawAnyParts = partsByMessage.size > 0;
        const entries: OpenCodeSessionEntry[] = [];
        let found = !afterMessageId;
        for (const row of messageRows) {
          const messageId = row.id;
          if (typeof messageId !== "string") continue;
          const inlineParts = extractInlineStoredParts(
            row.data,
            sessionId,
            messageId,
          );
          if (inlineParts.length > 0) sawAnyParts = true;
          if (!found) {
            if (messageId === afterMessageId) found = true;
            continue;
          }
          const message = asV2Message(
            row.data,
            messageId,
            sessionId,
            row.type,
            row.time_created,
          );
          if (!message) continue;
          const parts = partsByMessage.get(messageId) ?? inlineParts;
          entries.push({ message, parts });
        }

        // If the 2.x DB carries only accounting headers in `session_message`
        // without a `part`/`session_part` table or inline part bodies, return
        // null so full transcript reads fall through to `opencode export`.
        if (!partTable && !sawAnyParts) {
          return null;
        }
        return entries;
      }

      return null;
    });
  }

  private loadPartsByMessage(
    db: SqliteDatabase,
    partTable: "part" | "session_part",
    sessionId: string,
  ): Map<string, OpenCodeStoredPart[]> {
    const partRows = db
      .prepare(
        `SELECT id, message_id, data FROM ${partTable} WHERE session_id = ? ORDER BY id`,
      )
      .all(sessionId) as DbRow[];
    const partsByMessage = new Map<string, OpenCodeStoredPart[]>();
    for (const row of partRows) {
      const messageId = row.message_id;
      const partId = row.id;
      if (typeof messageId !== "string" || typeof partId !== "string") continue;
      const part = asStoredPart(row.data, partId, sessionId, messageId);
      if (!part) continue;
      const list = partsByMessage.get(messageId);
      if (list) list.push(part);
      else partsByMessage.set(messageId, [part]);
    }
    return partsByMessage;
  }

  /** Run a query callback against the handle, mapping any failure to null. */
  private async run<T>(fn: (db: SqliteDatabase) => T): Promise<T | null> {
    const db = this.ensureDb();
    if (!db) return null;
    try {
      return fn(db);
    } catch {
      // A locked/old-schema/corrupt read must fall through, never throw.
      return null;
    }
  }

  close(): void {
    this.closeHandle();
  }
}

function selectSessionCols(cols: Set<string>): string {
  const col = (name: string) => (cols.has(name) ? name : `NULL AS ${name}`);
  return [
    "id",
    col("title"),
    col("model"),
    col("time_created"),
    col("time_updated"),
  ].join(", ");
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseModel(value: unknown): OpenCodeDbSessionRow["model"] {
  const parsed = parseJson(value);
  if (!parsed) return null;
  return parsed as OpenCodeDbSessionRow["model"];
}

function extractModelFromMessageData(
  data: Record<string, unknown> | null,
): OpenCodeDbSessionRow["model"] {
  if (!data) return null;
  const nested =
    data.model && typeof data.model === "object" && !Array.isArray(data.model)
      ? (data.model as Record<string, unknown>)
      : null;
  const id =
    stringOrNull(nested?.id) ??
    stringOrNull(nested?.modelID) ??
    stringOrNull(data.modelID);
  const providerID =
    stringOrNull(data.providerID) ??
    stringOrNull(nested?.providerID) ??
    stringOrNull(nested?.provider);
  if (!id && !providerID) return null;
  return {
    ...(id ? { id } : {}),
    ...(providerID ? { providerID } : {}),
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseChildSessionRows(rows: DbRow[]): OpenCodeDbChildSessionRow[] {
  const out: OpenCodeDbChildSessionRow[] = [];
  for (const row of rows) {
    if (typeof row.id !== "string") continue;
    if (typeof row.parent_id !== "string" || row.parent_id.length === 0) {
      continue;
    }
    out.push({
      id: row.id,
      parentId: row.parent_id,
      title: typeof row.title === "string" ? row.title : null,
      agent: typeof row.agent === "string" ? row.agent : null,
      timeUpdated: numberOrNull(row.time_updated),
    });
  }
  return out;
}

function childSessionIdFromTaskPart(
  part: Record<string, unknown>,
): string | null {
  const state =
    part.state && typeof part.state === "object" && !Array.isArray(part.state)
      ? (part.state as Record<string, unknown>)
      : undefined;
  const metadata =
    state?.metadata &&
    typeof state.metadata === "object" &&
    !Array.isArray(state.metadata)
      ? (state.metadata as Record<string, unknown>)
      : undefined;
  const fromMeta =
    stringOrNull(metadata?.sessionId) ?? stringOrNull(metadata?.session_id);
  if (fromMeta) return fromMeta;
  const output = typeof state?.output === "string" ? state.output : "";
  return output.match(/session_id:\s*(ses_[A-Za-z0-9]+)/)?.[1] ?? null;
}

/** Parse `message.data` and inject the column-only id/sessionID. */
function asMessage(
  data: unknown,
  id: string,
  sessionId: string,
): OpenCodeMessage | null {
  const raw = parseJson(data);
  if (!raw) return null;
  const role = raw.role;
  if (role !== "user" && role !== "assistant") return null;
  return { ...raw, id, sessionID: sessionId, role } as OpenCodeMessage;
}

/** Parse OpenCode 2.x `session_message` row into `OpenCodeMessage`. */
function asV2Message(
  data: unknown,
  id: string,
  sessionId: string,
  roleColumn: unknown,
  timeCreatedColumn: unknown,
): OpenCodeMessage | null {
  const raw = parseJson(data) ?? {};
  const role = raw.role ?? roleColumn;
  if (role !== "user" && role !== "assistant") return null;

  const modelInfo = extractModelFromMessageData(raw);
  const rawTime =
    raw.time && typeof raw.time === "object" && !Array.isArray(raw.time)
      ? (raw.time as Record<string, unknown>)
      : {};
  const created =
    numberOrNull(rawTime.created) ?? numberOrNull(timeCreatedColumn) ?? 0;
  const completed = numberOrNull(rawTime.completed);

  return {
    ...raw,
    id,
    sessionID: sessionId,
    role,
    ...(modelInfo?.id ? { modelID: modelInfo.id } : {}),
    ...(modelInfo?.providerID ? { providerID: modelInfo.providerID } : {}),
    time: {
      ...rawTime,
      created,
      ...(completed !== null ? { completed } : {}),
    },
  } as OpenCodeMessage;
}

function extractFirstInlineText(
  info: Record<string, unknown> | null,
): string | null {
  if (!info) return null;
  if (typeof info.text === "string" && info.text.trim()) {
    return info.text.trim();
  }
  if (typeof info.content === "string" && info.content.trim()) {
    return info.content.trim();
  }
  if (Array.isArray(info.parts)) {
    for (const item of info.parts) {
      if (
        item &&
        typeof item === "object" &&
        (item as { type?: unknown }).type === "text" &&
        typeof (item as { text?: unknown }).text === "string" &&
        (item as { text: string }).text.trim().length > 0
      ) {
        return (item as { text: string }).text.trim();
      }
    }
  }
  return null;
}

function extractInlineStoredParts(
  data: unknown,
  sessionId: string,
  messageId: string,
): OpenCodeStoredPart[] {
  const raw = parseJson(data);
  if (!raw || !Array.isArray(raw.parts)) return [];
  const out: OpenCodeStoredPart[] = [];
  for (const [index, item] of raw.parts.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.type !== "string") continue;
    const id = stringOrNull(obj.id) ?? `${messageId}_p${index}`;
    out.push({
      ...obj,
      id,
      sessionID: sessionId,
      messageID: messageId,
    } as OpenCodeStoredPart);
  }
  return out;
}

/** Parse `part.data` and inject the column-only id/sessionID/messageID. */
function asStoredPart(
  data: unknown,
  id: string,
  sessionId: string,
  messageId: string,
): OpenCodeStoredPart | null {
  const raw = parseJson(data);
  if (!raw || typeof raw.type !== "string") return null;
  return {
    ...raw,
    id,
    sessionID: sessionId,
    messageID: messageId,
  } as OpenCodeStoredPart;
}
