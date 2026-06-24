import { ArrowDown, ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import type { DraftState } from "../state/app-state";
import type { Memo } from "../types";

export function CapturePage({
  draft,
  error,
  message,
  recentDrafts,
  isAnalyzing,
  onUpdateDraft,
  onLoadDraft,
  onAddTodo,
  onRemoveTodo,
  onMoveTodo,
  onAnalyze,
  onPublish
}: {
  draft: DraftState;
  error: string | null;
  message: string | null;
  recentDrafts: Memo[];
  isAnalyzing: boolean;
  onUpdateDraft: (patch: Partial<DraftState>) => void;
  onLoadDraft: (draftId: string) => void;
  onAddTodo: (title: string) => void;
  onRemoveTodo: (index: number) => void;
  onMoveTodo: (index: number, direction: "up" | "down") => void;
  onAnalyze: () => Promise<void>;
  onPublish: () => Promise<void>;
}) {
  const [newTodo, setNewTodo] = useState("");

  function addTodo() {
    onAddTodo(newTodo);
    setNewTodo("");
  }

  return (
    <div className="capture-layout">
      <section className="soft-card capture-editor paper-editor">
        <img className="capture-glow-asset" src="/assets/ui/top-breathing-glow.png" alt="" aria-hidden="true" />
        <label className="sr-only" htmlFor="memo-title">
          Memo 标题
        </label>
        <input
          id="memo-title"
          className="paper-title-input"
          placeholder="未命名 Memo"
          value={draft.title}
          onChange={(event) => onUpdateDraft({ title: event.target.value })}
        />
        <label className="sr-only" htmlFor="raw-memo">
          原始 Memo
        </label>
        <textarea
          id="raw-memo"
          className="paper-body-input"
          placeholder="随时记录..."
          value={draft.content}
          onChange={(event) => onUpdateDraft({ content: event.target.value })}
        />
        <button className="ai-floating-action" type="button" onClick={() => void onAnalyze()}>
          <img src="/assets/ui/ai-magic-orb.png" alt="" aria-hidden="true" />
          <span>{isAnalyzing ? "整理中" : "整理"}</span>
          <Sparkles size={15} aria-hidden="true" />
        </button>
        <div className="capture-footer">
          {message ? <p className="status-message">{message}</p> : <span aria-hidden="true" />}
          {error ? <p className="status-message status-message-error">{error}</p> : null}
          <button className="secondary-action" type="button" onClick={() => void onPublish()}>
            发布
          </button>
        </div>
        {recentDrafts.length > 0 ? (
          <div className="recent-drafts">
            {recentDrafts.map((recentDraft) => (
              <button
                className="secondary-action"
                key={recentDraft.id}
                type="button"
                aria-label={`载入草稿：${recentDraft.title}`}
                onClick={() => onLoadDraft(recentDraft.id)}
              >
                {recentDraft.title}
              </button>
            ))}
          </div>
        ) : null}
      </section>
      <section className="soft-card draft-card draft-list-panel">
        <label className="sr-only" htmlFor="new-todo">
          新增 Todo
        </label>
        <div className="todo-draft-row">
          <input id="new-todo" placeholder="添加一条 Todo" value={newTodo} onChange={(event) => setNewTodo(event.target.value)} />
          <button className="secondary-action" type="button" aria-label="添加 Todo" onClick={addTodo}>
            添加
          </button>
        </div>
        {draft.todos.length > 0 ? (
          <ul className="todo-list draft-todo-list">
            {draft.todos.map((todo, index) => (
              <li key={`${todo.title}-${index}`}>
                <span>{todo.title}</span>
                <button
                  aria-label={`上移草稿 Todo ${todo.title}`}
                  className="secondary-action icon-only-action compact-icon-action"
                  disabled={index === 0}
                  type="button"
                  onClick={() => onMoveTodo(index, "up")}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  aria-label={`下移草稿 Todo ${todo.title}`}
                  className="secondary-action icon-only-action compact-icon-action"
                  disabled={index === draft.todos.length - 1}
                  type="button"
                  onClick={() => onMoveTodo(index, "down")}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="text-action draft-delete-action"
                  type="button"
                  aria-label={`删除草稿 Todo ${todo.title}`}
                  onClick={() => onRemoveTodo(index)}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="draft-empty-state">
            <img src="/assets/ui/empty-memos-cloud.png" alt="" aria-hidden="true" />
          </div>
        )}
      </section>
    </div>
  );
}
