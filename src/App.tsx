import { Clock3, FileText, ListTodo, Settings, SquarePen } from "lucide-react";
import { useMemo, useState } from "react";

type PrimaryPage = "capture" | "memos" | "settings";
type Page = PrimaryPage | "history";

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
  const activePrimary = page === "history" ? "memos" : page;
  const title = useMemo(() => pageTitle(page), [page]);

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
          {page === "memos" ? <MemosPage /> : null}
          {page === "capture" ? <CapturePage /> : null}
          {page === "settings" ? <SettingsPage /> : null}
          {page === "history" ? <HistoryPage /> : null}
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

function MemosPage() {
  return (
    <div className="content-grid memos-grid">
      <section className="soft-card intro-card">
        <p className="section-kicker">当前 Memo 队列</p>
        <h2>还没有 Memo</h2>
        <p>
          从 Capture 写下一段原始想法，发布后 Memo 会出现在这里。越靠前越值得先处理，没有截止日期，也不会制造过期压力。
        </p>
      </section>
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
            整理 MemoTask 的实现方案
          </li>
          <li>
            <span className="checkbox-visual" />
            查找适合拖拽排序的交互库
          </li>
        </ul>
      </section>
    </div>
  );
}

function CapturePage() {
  return (
    <div className="capture-layout">
      <section className="soft-card capture-editor">
        <p className="section-kicker">写下原始想法</p>
        <label htmlFor="raw-memo">Raw Memo</label>
        <textarea id="raw-memo" placeholder="例如：研究 PWA 能不能覆盖手机和 PC，然后整理实现方案。" />
        <div className="inline-actions">
          <button className="primary-action" type="button">
            Analyze
          </button>
          <button className="secondary-action" type="button">
            Publish
          </button>
        </div>
      </section>
      <section className="soft-card draft-card">
        <p className="section-kicker">Todo 草稿</p>
        <h2>AI 结果发布前可编辑</h2>
        <p>Analyze 只在这里触发。发布后不会重新生成，也不会改变 Memo 排序。</p>
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

function HistoryPage() {
  return (
    <div className="content-grid">
      <section className="soft-card intro-card">
        <p className="section-kicker">完整 Memo 历史</p>
        <h2>还没有 History</h2>
        <p>完成归档和手动归档都会保存完整 Memo。这里支持搜索、恢复、批量软删除和短时间撤销。</p>
      </section>
      <section className="soft-card history-search-card">
        <label htmlFor="history-search">Search History</label>
        <input id="history-search" placeholder="搜索 Memo 标题、原文或 Todo" />
      </section>
    </div>
  );
}
