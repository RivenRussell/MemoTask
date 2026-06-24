import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { MemoCard } from "../components/MemoCard";
import type { Memo } from "../types";

export function MemosPage({
  memos,
  onMoveMemo,
  onOpenMemo,
  onReorderMemos,
  onToggleTodo
}: {
  memos: Memo[];
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
    <div className="content-grid memos-grid">
      {memos.length === 0 ? (
        <section className="soft-card intro-card empty-memo-card">
          <h2>还没有 Memo</h2>
        </section>
      ) : (
        <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={memos.map((memo) => memo.id)} strategy={rectSortingStrategy}>
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
  );
}
