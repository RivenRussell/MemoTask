import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MemoCard } from "../components/MemoCard";
import type { Memo } from "../types";

export function MemosPage({
  hasActiveFilters,
  memos,
  totalMemoCount,
  onClearFilters,
  onMoveMemo,
  onOpenMemo,
  onReorderMemos,
  onToggleTodo
}: {
  hasActiveFilters: boolean;
  memos: Memo[];
  totalMemoCount: number;
  onClearFilters: () => void;
  onMoveMemo: (memoId: string, direction: "up" | "down") => void;
  onOpenMemo: (memoId: string) => void;
  onReorderMemos: (memoIds: string[]) => void;
  onToggleTodo: (todoId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = memos.findIndex((memo) => memo.id === active.id);
    const newIndex = memos.findIndex((memo) => memo.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorderMemos(arrayMove(memos, oldIndex, newIndex).map((memo) => memo.id));
  }

  return (
    <div className="timeline-shell">
      <section className="feed-composer-card" aria-label="快速记录">
        <div className="composer-avatar">M</div>
        <div className="composer-copy">
          <h2>快速记录</h2>
          <p>像写下一条备忘录一样开始，之后再让 AI 拆成 Todo。</p>
        </div>
      </section>
      <div className="timeline-feed">
        {memos.length === 0 ? (
          <section className="empty-memo-card">
            <h2>{hasActiveFilters && totalMemoCount > 0 ? "没有匹配的 Memo" : "还没有 Memo"}</h2>
            <p>{hasActiveFilters && totalMemoCount > 0 ? "清除搜索或标签后可以回到完整队列。" : "新的备忘录会按队列顺序出现在这里。"}</p>
            {hasActiveFilters ? (
              <button className="secondary-action" type="button" onClick={onClearFilters}>
                清除筛选
              </button>
            ) : null}
          </section>
        ) : (
          <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={memos.map((memo) => memo.id)} strategy={verticalListSortingStrategy}>
              {memos.map((memo, index) => (
                <MemoCard
                  canMoveDown={index < memos.length - 1}
                  canMoveUp={index > 0}
                  key={memo.id}
                  memo={memo}
                  onMove={onMoveMemo}
                  onOpen={onOpenMemo}
                  onToggleTodo={onToggleTodo}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
