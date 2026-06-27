import { History, ListTodo, LogOut, Search, Settings, SquarePen } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PrimaryPage, Page } from "../state/app-state";

const primaryNav: Array<{
  id: PrimaryPage;
  label: string;
  icon: typeof SquarePen;
}> = [
  { id: "capture", label: "记录", icon: SquarePen },
  { id: "memos", label: "队列", icon: ListTodo },
  { id: "settings", label: "设置", icon: Settings }
];

export function AppShell({
  page,
  activePrimary,
  title,
  userEmail,
  onLogout,
  onNavigate,
  children
}: {
  page: Page;
  activePrimary: PrimaryPage;
  title: string;
  userEmail: string;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}) {
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (workspaceRef.current) {
      workspaceRef.current.scrollTop = 0;
    }
  }, [page, title]);

  return (
    <div className="app-frame">
      <aside className="app-rail desktop-sidebar" aria-label="桌面导航">
        <div className="brand-mark">
          <div className="brand-icon">M</div>
          <div>
            <p>MemoTask</p>
          </div>
        </div>
        <PrimaryNavigation activePage={activePrimary} onNavigate={onNavigate} ariaLabel="主导航" />
      </aside>

      <main className="workspace-main workspace-shell" ref={workspaceRef}>
        <header className="topbar">
          <div>
            <h1>{title}</h1>
          </div>
          {page === "memos" ? (
            <button className="icon-text-button topbar-history-action" type="button" aria-label="打开历史" onClick={() => onNavigate("history")}>
              <History size={17} />
              历史
            </button>
          ) : null}
          {page === "history" ? (
            <button className="secondary-action topbar-history-action" type="button" onClick={() => onNavigate("memos")}>
              <ListTodo size={17} />
              返回队列
            </button>
          ) : null}
          <button className="icon-text-button topbar-logout" type="button" onClick={onLogout}>
            <LogOut size={17} />
            退出
          </button>
        </header>

        <section className="page-surface" aria-label={`${title}页面`}>
          {children}
        </section>
      </main>

      <aside className="utility-sidebar" aria-label="工具栏">
        <section className="utility-panel utility-search-panel">
          <label htmlFor="memo-search-preview">
            <Search size={15} />
            筛选
          </label>
          <input id="memo-search-preview" placeholder="搜索备忘录" disabled />
        </section>
        <section className="utility-panel">
          <div className="utility-panel-heading">
            <h2>标签</h2>
            <button className="text-action utility-more-action" type="button" disabled aria-label="标签功能将在 v4.2.0 支持">
              ...
            </button>
          </div>
          <p className="muted-copy">标签会在 v4.2.0 支持。</p>
        </section>
        <section className="utility-panel">
          <h2>导航</h2>
          {page === "memos" ? (
            <button className="secondary-action utility-wide-action" type="button" aria-label="打开桌面历史" onClick={() => onNavigate("history")}>
              <History size={16} />
              历史
            </button>
          ) : null}
          {page === "history" ? (
            <button className="secondary-action utility-wide-action" type="button" aria-label="返回桌面队列" onClick={() => onNavigate("memos")}>
              <ListTodo size={16} />
              返回队列
            </button>
          ) : null}
          <button className="secondary-action utility-wide-action" type="button" onClick={() => onNavigate("capture")}>
            <SquarePen size={16} />
            写新 Memo
          </button>
        </section>
        <section className="utility-panel account-utility-panel">
          <h2>账号</h2>
          <p className="muted-copy">{userEmail}</p>
          <button className="secondary-action utility-wide-action" type="button" onClick={onLogout}>
            <LogOut size={16} />
            退出登录
          </button>
        </section>
      </aside>

      <PrimaryNavigation activePage={activePrimary} onNavigate={onNavigate} compact ariaLabel="移动主导航" />
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
