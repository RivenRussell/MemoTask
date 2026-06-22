import { Archive, RotateCcw } from "lucide-react";
import type { Memo } from "../types";

export function HistoryPage({ memos, onRestore }: { memos: Memo[]; onRestore: (memoId: string) => void }) {
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
        <input id="history-search" placeholder="搜索 Memo 标题、原文或 Todo" />
      </section>
    </div>
  );
}
