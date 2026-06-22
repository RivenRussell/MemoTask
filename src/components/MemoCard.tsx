import { ArrowDown, ArrowUp, FileText, Pencil } from "lucide-react";
import type { Memo } from "../types";

export function MemoCard({
  canMoveDown,
  canMoveUp,
  memo,
  onMove,
  onOpen,
  onToggleTodo
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  memo: Memo;
  onMove: (memoId: string, direction: "up" | "down") => void;
  onOpen: (memoId: string) => void;
  onToggleTodo: (todoId: string) => void;
}) {
  return (
    <article className="soft-card memo-card">
      <div className="card-heading">
        <FileText size={20} />
        <h2>{memo.title}</h2>
      </div>
      <p className="memo-content">{memo.content}</p>
      <ul className="todo-list">
        {memo.todos.slice(0, 3).map((todo) => (
          <li
            key={todo.id}
            className={todo.status === "done" ? "is-done" : undefined}
            style={todo.status === "done" ? { textDecoration: "none" } : undefined}
          >
            <input
              aria-label={todo.title}
              checked={todo.status === "done"}
              className="todo-checkbox"
              type="checkbox"
              onChange={() => onToggleTodo(todo.id)}
            />
            <span>{todo.title}</span>
          </li>
        ))}
      </ul>
      <div className="card-actions">
        <button
          aria-label={`上移 ${memo.title}`}
          className="secondary-action icon-only-action"
          disabled={!canMoveUp}
          type="button"
          onClick={() => onMove(memo.id, "up")}
        >
          <ArrowUp size={16} />
        </button>
        <button
          aria-label={`下移 ${memo.title}`}
          className="secondary-action icon-only-action"
          disabled={!canMoveDown}
          type="button"
          onClick={() => onMove(memo.id, "down")}
        >
          <ArrowDown size={16} />
        </button>
        <button className="secondary-action" type="button" aria-label={`打开 ${memo.title}`} onClick={() => onOpen(memo.id)}>
          <Pencil size={16} />
          详情
        </button>
      </div>
    </article>
  );
}
