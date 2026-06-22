import { Archive, ArrowLeft, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Memo } from "../types";

interface MemoDetailPageProps {
  memo: Memo;
  message: string | null;
  error: string | null;
  onArchive: () => void;
  onBack: () => void;
  onCreateTodo: (title: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onSaveMemo: (input: { title: string; content: string }) => void;
  onToggleTodo: (todoId: string) => void;
}

export function MemoDetailPage({
  memo,
  message,
  error,
  onArchive,
  onBack,
  onCreateTodo,
  onDeleteTodo,
  onSaveMemo,
  onToggleTodo
}: MemoDetailPageProps) {
  const [title, setTitle] = useState(memo.title);
  const [content, setContent] = useState(memo.content);
  const [newTodo, setNewTodo] = useState("");

  function createTodo() {
    onCreateTodo(newTodo);
    setNewTodo("");
  }

  return (
    <div className="capture-layout">
      <section className="soft-card capture-editor">
        <p className="section-kicker">Memo 深编辑</p>
        <label htmlFor="detail-title">详情标题</label>
        <input id="detail-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <label htmlFor="detail-content">详情原文</label>
        <textarea id="detail-content" value={content} onChange={(event) => setContent(event.target.value)} />
        {message ? <p className="status-message">{message}</p> : null}
        {error ? <p className="status-message status-message-error">{error}</p> : null}
        <div className="inline-actions">
          <button className="primary-action" type="button" onClick={() => onSaveMemo({ title, content })}>
            <Save size={16} />
            保存 Memo
          </button>
          <button className="secondary-action" type="button" onClick={onArchive}>
            <Archive size={16} />
            手动归档
          </button>
          <button className="secondary-action" type="button" onClick={onBack}>
            <ArrowLeft size={16} />
            返回队列
          </button>
        </div>
      </section>

      <section className="soft-card draft-card">
        <p className="section-kicker">Todo</p>
        <label htmlFor="detail-new-todo">详情新增 Todo</label>
        <div className="todo-draft-row">
          <input id="detail-new-todo" value={newTodo} onChange={(event) => setNewTodo(event.target.value)} />
          <button className="secondary-action" type="button" onClick={createTodo}>
            新增 Todo
          </button>
        </div>
        <ul className="todo-list">
          {memo.todos.map((todo) => (
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
              <button className="text-action" type="button" aria-label={`删除 ${todo.title}`} onClick={() => onDeleteTodo(todo.id)}>
                <Trash2 size={15} />
                删除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
