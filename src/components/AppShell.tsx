import { Clock3, ListTodo, Settings, SquarePen } from "lucide-react";
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
  onNavigate,
  children
}: {
  page: Page;
  activePrimary: PrimaryPage;
  title: string;
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
      <aside className="desktop-sidebar" aria-label="桌面导航">
        <div className="brand-mark">
          <div className="brand-icon">M</div>
          <div>
            <p>MemoTask</p>
            <span>低压力 Memo 队列</span>
          </div>
        </div>
        <PrimaryNavigation activePage={activePrimary} onNavigate={onNavigate} ariaLabel="主导航" />
      </aside>

      <main className="workspace-shell" ref={workspaceRef}>
        <header className="topbar">
          <div>
            <p className="section-kicker">Memo 容器 · 顺序即优先级</p>
            <h1>{title}</h1>
          </div>
          {page === "memos" ? (
            <button className="icon-text-button" type="button" aria-label="打开历史" onClick={() => onNavigate("history")}>
              <Clock3 size={18} />
              历史
            </button>
          ) : null}
          {page === "history" ? (
            <button className="icon-text-button" type="button" onClick={() => onNavigate("memos")}>
              返回队列
            </button>
          ) : null}
        </header>

        <section className="page-surface" aria-label={`${title}页面`}>
          {children}
        </section>
      </main>

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
