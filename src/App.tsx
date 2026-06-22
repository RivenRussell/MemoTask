import { Archive, Clock3, FileText, ListTodo, RotateCcw, Settings, SquarePen } from "lucide-react";
import { useMemo, useState } from "react";

type PrimaryPage = "capture" | "memos" | "settings";
type Page = PrimaryPage | "history";
type MemoStatus = "active" | "history";

interface TodoItem {
  id: string;
  title: string;
  status: "todo" | "done";
}

interface MemoItem {
  id: string;
  title: string;
  content: string;
  status: MemoStatus;
  autoArchiveSuppressedUntilChange: boolean;
  sortOrder: number;
  todos: TodoItem[];
}

const primaryNav: Array<{
  id: PrimaryPage;
  label: string;
  icon: typeof SquarePen;
}> = [
  { id: "capture", label: "Capture", icon: SquarePen },
  { id: "memos", label: "Memos", icon: ListTodo },
  { id: "settings", label: "Settings", icon: Settings }
];

function pageTitle(page: Page): string {
  if (page === "capture") return "Capture";
  if (page === "settings") return "Settings";
  if (page === "history") return "History";
  return "Memos";
}

export default function App() {
  const [page, setPage] = useState<Page>("memos");
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const activePrimary = page === "history" ? "memos" : page;
  const title = useMemo(() => pageTitle(page), [page]);
  const activeMemos = memos.filter((memo) => memo.status === "active").sort((a, b) => a.sortOrder - b.sortOrder);
  const historyMemos = memos.filter((memo) => memo.status === "history");

  function publishMemo(input: { title: string; content: string; todos: string[] }) {
    const nextMemo: MemoItem = {
      id: crypto.randomUUID(),
      title: input.title.trim() || "未命名 Memo",
      content: input.content,
      status: "active",
      autoArchiveSuppressedUntilChange: false,
      sortOrder: activeMemos.length === 0 ? 1000 : activeMemos[0].sortOrder - 1,
      todos: input.todos.map((todo) => ({
        id: crypto.randomUUID(),
        title: todo,
        status: "todo"
      }))
    };

    setMemos((current) => [nextMemo, ...current]);
    setPage("memos");
  }

  function toggleTodo(memoId: string, todoId: string) {
    setMemos((current) =>
      current.map((memo) => {
        if (memo.id !== memoId || memo.status !== "active") {
          return memo;
        }

        const todos: TodoItem[] = memo.todos.map((todo) => {
          if (todo.id !== todoId) {
            return todo;
          }

          const status: TodoItem["status"] = todo.status === "done" ? "todo" : "done";
          return { ...todo, status };
        });
        const suppressWasActive = memo.autoArchiveSuppressedUntilChange;
        const shouldArchive =
          !suppressWasActive && todos.length > 0 && todos.every((todo) => todo.status === "done");

        return {
          ...memo,
          todos,
          status: shouldArchive ? "history" : "active",
          autoArchiveSuppressedUntilChange: suppressWasActive ? false : memo.autoArchiveSuppressedUntilChange
        };
      })
    );
  }

  function restoreMemo(memoId: string) {
    setMemos((current) =>
      current.map((memo) =>
        memo.id === memoId
          ? {
              ...memo,
              status: "active",
              autoArchiveSuppressedUntilChange: true,
              sortOrder: activeMemos.length === 0 ? 1000 : activeMemos[0].sortOrder - 1
            }
          : memo
      )
    );
    setPage("memos");
  }

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar" aria-label="桌面导航">
        <div className="brand-mark">
          <div className="brand-icon">M</div>
          <div>
            <p>MemoTask</p>
            <span>低压力 Memo 队列</span>
          </div>
        </div>
        <PrimaryNavigation activePage={activePrimary} onNavigate={setPage} ariaLabel="主导航" />
      </aside>

      <main className="workspace-shell">
        <header className="topbar">
          <div>
            <p className="section-kicker">Memo 容器 · 顺序即优先级</p>
            <h1>{title}</h1>
          </div>
          {page === "memos" ? (
            <button className="icon-text-button" type="button" aria-label="打开 History" onClick={() => setPage("history")}>
              <Clock3 size={18} />
              History
            </button>
          ) : null}
          {page === "history" ? (
            <button className="icon-text-button" type="button" onClick={() => setPage("memos")}>
              返回 Memos
            </button>
          ) : null}
        </header>

        <section className="page-surface" aria-label={`${title} 页面`}>
          {page === "memos" ? <MemosPage memos={activeMemos} onToggleTodo={toggleTodo} /> : null}
          {page === "capture" ? <CapturePage onPublish={publishMemo} /> : null}
          {page === "settings" ? <SettingsPage /> : null}
          {page === "history" ? <HistoryPage memos={historyMemos} onRestore={restoreMemo} /> : null}
        </section>
      </main>

      <PrimaryNavigation activePage={activePrimary} onNavigate={setPage} compact ariaLabel="移动主导航" />
    </div>
  );
}

function PrimaryNavigation({
  activePage,
  onNavigate,
  compact = false,
  ariaLabel
}: {
  activePage: PrimaryPage;
  onNavigate: (page: PrimaryPage) => void;
  compact?: boolean;
  ariaLabel: string;
}) {
  return (
    <nav className={compact ? "mobile-bottom-nav nav-group nav-group-compact" : "nav-group"} aria-label={ariaLabel}>
      {primaryNav.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            className={isActive ? "nav-button is-active" : "nav-button"}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function MemosPage({
  memos,
  onToggleTodo
}: {
  memos: MemoItem[];
  onToggleTodo: (memoId: string, todoId: string) => void;
}) {
  return (
    <div className="content-grid memos-grid">
      {memos.length === 0 ? (
        <>
          <section className="soft-card intro-card">
            <p className="section-kicker">当前 Memo 队列</p>
            <h2>还没有 Memo</h2>
            <p>
              从 Capture 写下一段原始想法，发布后 Memo 会出现在这里。越靠前越值得先处理，没有截止日期，也不会制造过期压力。
            </p>
          </section>
          <PreviewMemoCard />
        </>
      ) : (
        memos.map((memo) => <MemoCard key={memo.id} memo={memo} onToggleTodo={onToggleTodo} />)
      )}
    </div>
  );
}

function PreviewMemoCard() {
  return (
    <section className="soft-card memo-preview-card">
      <div className="card-heading">
        <FileText size={20} />
        <h2>Memo 卡片预览</h2>
      </div>
      <p className="memo-title">研究 PWA 和拖拽方案</p>
      <ul className="todo-list">
        <li>
          <span className="checkbox-visual" />
          调研 PWA 对手机和 PC 的支持情况
        </li>
        <li className="is-done">
          <span className="checkbox-visual is-checked" />
          <span>整理 MemoTask 的实现方案</span>
        </li>
        <li>
          <span className="checkbox-visual" />
          查找适合拖拽排序的交互库
        </li>
      </ul>
    </section>
  );
}

function MemoCard({ memo, onToggleTodo }: { memo: MemoItem; onToggleTodo: (memoId: string, todoId: string) => void }) {
  return (
    <article className="soft-card memo-card">
      <div className="card-heading">
        <FileText size={20} />
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
            <input
              aria-label={todo.title}
              checked={todo.status === "done"}
              className="todo-checkbox"
              type="checkbox"
              onChange={() => onToggleTodo(memo.id, todo.id)}
            />
            <span>{todo.title}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CapturePage({ onPublish }: { onPublish: (input: { title: string; content: string; todos: string[] }) => void }) {
  const [rawMemo, setRawMemo] = useState("");
  const [title, setTitle] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [todos, setTodos] = useState<string[]>([]);

  function addTodo() {
    const trimmed = newTodo.trim();
    if (!trimmed) {
      return;
    }
    setTodos((current) => [...current, trimmed]);
    setNewTodo("");
  }

  function publish() {
    if (!rawMemo.trim()) {
      return;
    }

    onPublish({ title, content: rawMemo, todos });
    setRawMemo("");
    setTitle("");
    setTodos([]);
  }

  return (
    <div className="capture-layout">
      <section className="soft-card capture-editor">
        <p className="section-kicker">写下原始想法</p>
        <label htmlFor="raw-memo">Raw Memo</label>
        <textarea
          id="raw-memo"
          placeholder="例如：研究 PWA 能不能覆盖手机和 PC，然后整理实现方案。"
          value={rawMemo}
          onChange={(event) => setRawMemo(event.target.value)}
        />
        <label htmlFor="memo-title">Memo 标题</label>
        <input id="memo-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <div className="inline-actions">
          <button className="primary-action" type="button">
            Analyze
          </button>
          <button className="secondary-action" type="button" onClick={publish}>
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
        {todos.length > 0 ? (
          <ul className="todo-list">
            {todos.map((todo) => (
              <li key={todo}>{todo}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="settings-layout">
      <section className="soft-card settings-card">
        <p className="section-kicker">AI API</p>
        <label htmlFor="base-url">Base URL</label>
        <input id="base-url" placeholder="https://api.example.com/v1" />
        <label htmlFor="model">Model</label>
        <input id="model" defaultValue="dsv4-pro" />
        <label htmlFor="api-key">API Key</label>
        <input id="api-key" placeholder="sk-...b456" type="password" />
        <button className="primary-action" type="button">
          Test connection
        </button>
      </section>
      <section className="soft-card settings-card">
        <p className="section-kicker">Prompt</p>
        <textarea defaultValue="你是 MemoTask 的整理助手。" />
        <button className="secondary-action" type="button">
          Restore default
        </button>
      </section>
    </div>
  );
}

function HistoryPage({ memos, onRestore }: { memos: MemoItem[]; onRestore: (memoId: string) => void }) {
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
