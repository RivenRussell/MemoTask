import { FileText } from "lucide-react";
import type { Memo } from "../types";

export function MemoCard({ memo, onToggleTodo }: { memo: Memo; onToggleTodo: (todoId: string) => void }) {
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
    </article>
  );
}
