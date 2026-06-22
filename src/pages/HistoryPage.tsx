import { Archive, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Memo } from "../types";

interface HistoryPageProps {
  memos: Memo[];
  query: string;
  message: string | null;
  canUndoDelete: boolean;
  onSearch: (query: string) => void;
  onBulkDelete: (memoIds: string[]) => void;
  onUndoDelete: () => void;
  onRestore: (memoId: string) => void;
}

export function HistoryPage({
  memos,
  query,
  message,
  canUndoDelete,
  onSearch,
  onBulkDelete,
  onUndoDelete,
  onRestore
}: HistoryPageProps) {
  const [selectedMemoIds, setSelectedMemoIds] = useState<string[]>([]);

  function toggleSelection(memoId: string) {
    setSelectedMemoIds((current) =>
      current.includes(memoId) ? current.filter((candidate) => candidate !== memoId) : [...current, memoId]
    );
  }

  function bulkDelete() {
    onBulkDelete(selectedMemoIds);
    setSelectedMemoIds([]);
  }

  return (
    <div className="content-grid">
      {memos.length === 0 ? (
        <section className="soft-card intro-card">
          <p className="section-kicker">完整 Memo 历史</p>
          <h2>还没有 History</h2>
          <p>完成归档和手动归档都会保存完整 Memo。这里支持搜索、恢复、批量软删除和短时间撤销。</p>
        </section>
      ) : (
        memos.map((memo) => (
          <article className="soft-card memo-card" key={memo.id}>
            <div className="card-heading">
              <input
                aria-label={`选择 ${memo.title}`}
                checked={selectedMemoIds.includes(memo.id)}
                className="todo-checkbox"
                type="checkbox"
                onChange={() => toggleSelection(memo.id)}
              />
              <Archive size={20} />
              <h2>{memo.title}</h2>
            </div>
            <p className="memo-content">{memo.content}</p>
            <ul className="todo-list">
              {memo.todos.map((todo) => (
                <li
                  key={todo.id}
                  className={todo.status === "done" ? "is-done" : undefined}
                  style={todo.status === "done" ? { textDecoration: "none" } : undefined}
                >
                  <span className={todo.status === "done" ? "checkbox-visual is-checked" : "checkbox-visual"} />
                  <span>{todo.title}</span>
                </li>
              ))}
            </ul>
            <button className="secondary-action" type="button" aria-label={`恢复 ${memo.title}`} onClick={() => onRestore(memo.id)}>
              <RotateCcw size={16} />
              Restore
            </button>
          </article>
        ))
      )}
      <section className="soft-card history-search-card">
        <label htmlFor="history-search">Search History</label>
        <input
          id="history-search"
          placeholder="搜索 Memo 标题、原文或 Todo"
          value={query}
          onChange={(event) => onSearch(event.target.value)}
        />
        <div className="inline-actions">
          <button className="secondary-action" type="button" onClick={bulkDelete}>
            删除所选
          </button>
          {canUndoDelete ? (
            <button className="secondary-action" type="button" onClick={onUndoDelete}>
              撤销删除
            </button>
          ) : null}
        </div>
        {message ? <p className="status-message">{message}</p> : null}
      </section>
    </div>
  );
}
