import { useState } from "react";
import type { DraftState } from "../state/app-state";

export function CapturePage({
  draft,
  error,
  onUpdateDraft,
  onAddTodo,
  onRemoveTodo,
  onPublish
}: {
  draft: DraftState;
  error: string | null;
  onUpdateDraft: (patch: Partial<DraftState>) => void;
  onAddTodo: (title: string) => void;
  onRemoveTodo: (index: number) => void;
  onPublish: () => Promise<void>;
}) {
  const [newTodo, setNewTodo] = useState("");

  function addTodo() {
    onAddTodo(newTodo);
    setNewTodo("");
  }

  return (
    <div className="capture-layout">
      <section className="soft-card capture-editor">
        <p className="section-kicker">写下原始想法</p>
        <label htmlFor="raw-memo">Raw Memo</label>
        <textarea
          id="raw-memo"
          placeholder="例如：研究 PWA 能不能覆盖手机和 PC，然后整理实现方案。"
          value={draft.content}
          onChange={(event) => onUpdateDraft({ content: event.target.value })}
        />
        <label htmlFor="memo-title">Memo 标题</label>
        <input id="memo-title" value={draft.title} onChange={(event) => onUpdateDraft({ title: event.target.value })} />
        {error ? <p className="inline-error">{error}</p> : null}
        <div className="inline-actions">
          <button className="primary-action" type="button">
            Analyze
          </button>
          <button className="secondary-action" type="button" onClick={() => void onPublish()}>
            Publish
          </button>
        </div>
      </section>
      <section className="soft-card draft-card">
        <p className="section-kicker">Todo 草稿</p>
        <h2>AI 结果发布前可编辑</h2>
        <p>Analyze 只在这里触发。发布后不会重新生成，也不会改变 Memo 排序。</p>
        <label htmlFor="new-todo">新增 Todo</label>
        <div className="todo-draft-row">
          <input id="new-todo" value={newTodo} onChange={(event) => setNewTodo(event.target.value)} />
          <button className="secondary-action" type="button" onClick={addTodo}>
            添加 Todo
          </button>
        </div>
        {draft.todos.length > 0 ? (
          <ul className="todo-list">
            {draft.todos.map((todo, index) => (
              <li key={`${todo.title}-${index}`}>
                <span>{todo.title}</span>
                <button className="text-action" type="button" onClick={() => onRemoveTodo(index)}>
                  删除
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
