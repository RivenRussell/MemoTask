import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, CheckCircle2, GripHorizontal, Pencil } from "lucide-react";
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: memo.id });
  const visibleTodos = memo.todos.slice(0, 3);
  const remainingTodoCount = Math.max(0, memo.todos.length - visibleTodos.length);
  const completedTodoCount = memo.todos.filter((todo) => todo.status === "done").length;

  return (
    <article
      className={`memo-feed-item memo-card${isDragging ? " is-dragging" : ""}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label={`拖动排序 ${memo.title}`}
        className="memo-hover-handle drag-handle"
        title="拖动排序"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripHorizontal size={16} />
      </button>
      <header className="memo-feed-header">
        <div className="memo-avatar">M</div>
        <div className="memo-feed-meta">
          <span>MemoTask</span>
          <time dateTime={memo.updatedAt}>{formatMemoTime(memo.updatedAt)}</time>
        </div>
      </header>
      <div className="card-heading memo-feed-title">
        <h2>{memo.title}</h2>
        {memo.todos.length > 0 ? (
          <span className="todo-count-pill memo-progress-pill">
            <CheckCircle2 size={14} />
            {completedTodoCount}/{memo.todos.length}
          </span>
        ) : null}
      </div>
      <p className="memo-content memo-feed-content">{memo.content}</p>
      <ul className="todo-list memo-feed-todos">
        {visibleTodos.map((todo) => (
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
        {remainingTodoCount > 0 ? <li className="todo-remaining">还有 {remainingTodoCount} 个 Todo</li> : null}
      </ul>
      <footer className="card-actions memo-feed-actions">
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
      </footer>
    </article>
  );
}

function formatMemoTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
