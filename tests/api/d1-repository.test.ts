import { describe, expect, it } from "vitest";
import { moveMemoToHistory } from "../../worker/domain/state-machines";
import { D1Repository } from "../../worker/repository/d1-repository";

class CannedD1Database {
  public readonly statements: Array<{ query: string; values: unknown[] }> = [];

  constructor(
    private readonly memos: Record<string, unknown>[],
    private readonly todos: Record<string, unknown>[],
    private settings: Record<string, unknown> | null = null
  ) {}

  prepare(query: string): D1PreparedStatement {
    return new CannedD1Statement(this, query) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    for (const statement of statements as unknown as CannedD1Statement[]) {
      await statement.run();
    }
    return statements.map(() => ({ success: true, meta: d1Meta(), results: [] as T[] }) as D1Result<T>);
  }

  async exec(): Promise<D1ExecResult> {
    return { count: 0, duration: 0 };
  }

  record(query: string, values: unknown[]) {
    this.statements.push({ query, values });
  }

  selectAll(query: string, values: unknown[] = []): Record<string, unknown>[] {
    if (query.includes("FROM memo_todos")) {
      const memoIds = values.filter((value): value is string => typeof value === "string");
      return memoIds.length > 0 ? this.todos.filter((todo) => memoIds.includes(String(todo.memo_id))) : this.todos;
    }
    if (query.includes("FROM memos")) {
      const memoIds = values.filter((value): value is string => typeof value === "string" && value !== "default");
      return memoIds.length > 0 ? this.memos.filter((memo) => memoIds.includes(String(memo.id))) : this.memos;
    }
    return [];
  }

  selectFirst(query: string, values: unknown[] = []): Record<string, unknown> | null {
    if (query.includes("FROM ai_settings")) {
      return this.settings;
    }
    if (query.includes("MIN(sort_order)")) {
      return { value: 1000 };
    }
    return this.selectAll(query, values)[0] ?? null;
  }

  upsertSettings(values: unknown[]) {
    this.settings = {
      id: values[0],
      user_id: values[1],
      base_url: values[2],
      model: values[3],
      encrypted_api_key: values[4],
      api_key_mask: values[5],
      prompt_template: values[6],
      created_at: values[7],
      updated_at: values[8]
    };
  }
}

class CannedD1Statement {
  private values: unknown[] = [];

  constructor(
    private readonly db: CannedD1Database,
    private readonly query: string
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.selectFirst(this.query, this.values) as T | null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return { success: true, meta: d1Meta(), results: this.db.selectAll(this.query, this.values) as T[] };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.db.record(this.query, this.values);
    if (this.query.includes("INTO ai_settings")) {
      this.db.upsertSettings(this.values);
    }
    return { success: true, meta: d1Meta(), results: [] as T[] } as D1Result<T>;
  }

  async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    return options?.columnNames ? ([[], ...([] as T[])] as [string[], ...T[]]) : [];
  }
}

function d1Meta(): D1Meta & Record<string, unknown> {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: true,
    changes: 0
  };
}

describe("D1Repository", () => {
  it("maps memo and todo rows from D1 without moving completed todos", async () => {
    const db = new CannedD1Database(
      [
        {
          id: "memo-1",
          user_id: "default",
          title: "D1 Memo",
          content: "D1 content",
          status: "active",
          history_reason: null,
          sort_order: 1,
          last_active_sort_order: null,
          auto_archive_suppressed_until_change: 0,
          ai_state: "idle",
          ai_error: null,
          created_at: "2026-06-22T12:00:00.000Z",
          updated_at: "2026-06-22T12:00:00.000Z",
          published_at: "2026-06-22T12:00:00.000Z",
          history_at: null,
          deleted_at: null
        }
      ],
      [
        {
          id: "todo-1",
          memo_id: "memo-1",
          title: "保持原位置",
          notes: null,
          status: "done",
          sort_order: 1,
          generated_by_ai: 0,
          created_at: "2026-06-22T12:00:00.000Z",
          updated_at: "2026-06-22T12:00:00.000Z",
          completed_at: "2026-06-22T12:00:00.000Z",
          deleted_at: null
        }
      ]
    );
    const repository = new D1Repository(db as unknown as D1Database);

    const memos = await repository.listActiveMemos("default");

    expect(memos).toHaveLength(1);
    expect(memos[0].todos[0]).toMatchObject({ title: "保持原位置", status: "done", sortOrder: 1 });
  });

  it("persists saved memo state through D1 update statements", async () => {
    const db = new CannedD1Database([], []);
    const repository = new D1Repository(db as unknown as D1Database);
    const archived = moveMemoToHistory(
      {
        id: "memo-1",
        userId: "default",
        title: "归档 Memo",
        content: "content",
        status: "active",
        historyReason: null,
        sortOrder: 1,
        lastActiveSortOrder: null,
        autoArchiveSuppressedUntilChange: false,
        aiState: "idle",
        aiError: null,
        createdAt: "2026-06-22T12:00:00.000Z",
        updatedAt: "2026-06-22T12:00:00.000Z",
        publishedAt: "2026-06-22T12:00:00.000Z",
        historyAt: null,
        deletedAt: null,
        todos: []
      },
      "archived",
      "2026-06-22T12:01:00.000Z"
    );

    await repository.saveMemo("default", archived);

    expect(db.statements.some((statement) => statement.query.includes("INTO memos"))).toBe(true);
    expect(db.statements.flatMap((statement) => statement.values)).toContain("history");
    expect(db.statements.flatMap((statement) => statement.values)).toContain("archived");
  });

  it("stores AI settings with caller-provided ciphertext and no plaintext key", async () => {
    const db = new CannedD1Database([], []);
    const repository = new D1Repository(db as unknown as D1Database);

    const settings = await repository.saveAiSettings(
      "default",
      {
        baseUrl: "https://api.example.com/v1",
        model: "dsv4-pro",
        encryptedApiKey: "v1:iv:cipher",
        apiKeyMask: "test...cdef",
        promptTemplate: "整理 Memo"
      },
      "2026-06-22T12:00:00.000Z"
    );

    expect(settings.apiKeyMask).toBe("test...cdef");
    expect(JSON.stringify(settings)).not.toContain("1234567890");
    expect(settings.encryptedApiKey).toBe("v1:iv:cipher");
    expect(settings.userId).toBe("default");
  });

  it("soft-deletes history memos with one scoped update instead of per-memo upserts", async () => {
    const db = new CannedD1Database(
      [
        memoRow({ id: "history-1", title: "History 1", status: "history", history_at: "2026-06-22T12:10:00.000Z" }),
        memoRow({ id: "history-2", title: "History 2", status: "history", history_at: "2026-06-22T12:09:00.000Z" })
      ],
      []
    );
    const repository = new D1Repository(db as unknown as D1Database);

    const deleted = await repository.softDeleteHistoryMemos("default", ["history-1", "history-2"], "2026-06-22T12:30:00.000Z");

    expect(deleted.map((memo) => memo.id)).toEqual(["history-1", "history-2"]);
    expect(deleted.every((memo) => memo.status === "deleted" && memo.deletedAt === "2026-06-22T12:30:00.000Z")).toBe(true);
    const updateStatements = db.statements.filter((statement) => statement.query.trim().startsWith("UPDATE memos"));
    expect(updateStatements).toHaveLength(1);
    expect(updateStatements[0].query).toContain("id IN (?, ?)");
    expect(updateStatements[0].query).toContain("user_id = ?");
    expect(db.statements.some((statement) => statement.query.includes("INTO memos"))).toBe(false);
  });

  it("restores deleted memos with one scoped update instead of per-memo upserts", async () => {
    const db = new CannedD1Database(
      [
        memoRow({ id: "deleted-1", title: "Deleted 1", status: "deleted", deleted_at: "2026-06-22T12:20:00.000Z" }),
        memoRow({ id: "deleted-2", title: "Deleted 2", status: "deleted", deleted_at: "2026-06-22T12:21:00.000Z" })
      ],
      []
    );
    const repository = new D1Repository(db as unknown as D1Database);

    const restored = await repository.restoreDeletedMemos("default", ["deleted-1", "deleted-2"], "2026-06-22T12:40:00.000Z");

    expect(restored.map((memo) => memo.id)).toEqual(["deleted-1", "deleted-2"]);
    expect(restored.every((memo) => memo.status === "history" && memo.deletedAt === null)).toBe(true);
    const updateStatements = db.statements.filter((statement) => statement.query.trim().startsWith("UPDATE memos"));
    expect(updateStatements).toHaveLength(1);
    expect(updateStatements[0].query).toContain("id IN (?, ?)");
    expect(updateStatements[0].query).toContain("user_id = ?");
    expect(db.statements.some((statement) => statement.query.includes("INTO memos"))).toBe(false);
  });
});

function memoRow(overrides: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: "memo-1",
    user_id: "default",
    title: "D1 Memo",
    content: "D1 content",
    status: "active",
    history_reason: null,
    sort_order: 1,
    last_active_sort_order: null,
    auto_archive_suppressed_until_change: 0,
    ai_state: "idle",
    ai_error: null,
    created_at: "2026-06-22T12:00:00.000Z",
    updated_at: "2026-06-22T12:00:00.000Z",
    published_at: "2026-06-22T12:00:00.000Z",
    history_at: null,
    deleted_at: null,
    ...overrides
  };
}
