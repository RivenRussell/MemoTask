import { RotateCcw } from "lucide-react";
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
        <section className="soft-card intro-card empty-history-card">
          <img src="/assets/ui/empty-history-hourglass.png" alt="" aria-hidden="true" />
          <h2>还没有历史 Memo</h2>
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
              恢复
            </button>
          </article>
        ))
      )}
      <section className="soft-card history-search-card">
        <label htmlFor="history-search">搜索历史</label>
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
