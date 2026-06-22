import { FileText } from "lucide-react";
import { MemoCard } from "../components/MemoCard";
import type { Memo } from "../types";

export function MemosPage({
  memos,
  onOpenMemo,
  onToggleTodo
}: {
  memos: Memo[];
  onOpenMemo: (memoId: string) => void;
  onToggleTodo: (todoId: string) => void;
}) {
  return (
    <div className="content-grid memos-grid">
      {memos.length === 0 ? (
        <>
          <section className="soft-card intro-card">
            <p className="section-kicker">当前 Memo 队列</p>
            <h2>还没有 Memo</h2>
            <p>
              从 Capture 写下一段原始想法，发布后 Memo 会出现在这里。越靠前越值得先处理，不会制造过期压力。
            </p>
          </section>
          <PreviewMemoCard />
        </>
      ) : (
        memos.map((memo) => <MemoCard key={memo.id} memo={memo} onOpen={onOpenMemo} onToggleTodo={onToggleTodo} />)
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
