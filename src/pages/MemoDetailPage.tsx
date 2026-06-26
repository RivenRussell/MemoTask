import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArrowLeft, CheckCircle2, GripVertical, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Memo, MemoTodo } from "../types";

interface MemoDetailPageProps {
  memo: Memo;
  message: string | null;
  error: string | null;
  onArchive: () => void;
  onBack: () => void;
  onCreateTodo: (title: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onReorderTodos: (todoIds: string[]) => void;
  onSaveMemo: (input: { title: string; content: string }) => void;
  onToggleTodo: (todoId: string) => void;
  onUpdateTodo: (todoId: string, title: string) => void;
}

export function MemoDetailPage({
  memo,
  message,
  error,
  onArchive,
  onBack,
  onCreateTodo,
  onDeleteTodo,
  onReorderTodos,
  onSaveMemo,
  onToggleTodo,
  onUpdateTodo
}: MemoDetailPageProps) {
  const [title, setTitle] = useState(memo.title);
  const [content, setContent] = useState(memo.content);
  const [newTodo, setNewTodo] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function createTodo() {
    onCreateTodo(newTodo);
    setNewTodo("");
  }

  function handleTodoDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = memo.todos.findIndex((todo) => todo.id === active.id);
    const newIndex = memo.todos.findIndex((todo) => todo.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorderTodos(arrayMove(memo.todos, oldIndex, newIndex).map((todo) => todo.id));
  }

  const completedTodoCount = memo.todos.filter((todo) => todo.status === "done").length;

  return (
    <div className="capture-layout memo-detail-layout">
      <section className="soft-card capture-editor paper-editor memo-detail-editor">
        <label className="sr-only" htmlFor="detail-title">
          详情标题
        </label>
        <input id="detail-title" className="paper-title-input" value={title} onChange={(event) => setTitle(event.target.value)} />
        <label className="sr-only" htmlFor="detail-content">
          详情原文
        </label>
        <textarea
          id="detail-content"
          className="paper-body-input memo-detail-content-input"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        {message ? <p className="status-message">{message}</p> : null}
        {error ? <p className="status-message status-message-error">{error}</p> : null}
        <div className="inline-actions memo-detail-actions">
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

      <section className="soft-card draft-card memo-detail-todos">
        <div className="todo-panel-heading">
          <div>
            <h2>Todo 管理</h2>
          </div>
          <span className="todo-count-pill">
            <CheckCircle2 size={15} />
            {completedTodoCount}/{memo.todos.length}
          </span>
        </div>
        <label className="sr-only" htmlFor="detail-new-todo">
          详情新增 Todo
        </label>
        <div className="todo-draft-row">
          <input
            id="detail-new-todo"
            placeholder="添加一条 Todo"
            value={newTodo}
            onChange={(event) => setNewTodo(event.target.value)}
          />
          <button className="secondary-action" type="button" aria-label="新增 Todo" onClick={createTodo}>
            添加
          </button>
        </div>
        <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleTodoDragEnd}>
          <SortableContext items={memo.todos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
            <ul className="todo-list memo-detail-todo-list">
              {memo.todos.map((todo) => (
                <SortableTodoRow
                  key={todo.id}
                  todo={todo}
                  onDeleteTodo={onDeleteTodo}
                  onToggleTodo={onToggleTodo}
                  onUpdateTodo={onUpdateTodo}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  );
}

function SortableTodoRow({
  todo,
  onDeleteTodo,
  onToggleTodo,
  onUpdateTodo
}: {
  todo: MemoTodo;
  onDeleteTodo: (todoId: string) => void;
  onToggleTodo: (todoId: string) => void;
  onUpdateTodo: (todoId: string, title: string) => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });

  useEffect(() => {
    const titleInput = titleInputRef.current;
    if (!titleInput) {
      return;
    }

    titleInput.style.height = "auto";
    titleInput.style.height = `${titleInput.scrollHeight}px`;
  }, [title]);

  function saveTodoTitle() {
    if (title.trim() && title.trim() !== todo.title) {
      onUpdateTodo(todo.id, title);
    }
  }

  function handleTodoTitleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <li
      className={`todo-edit-row${todo.status === "done" ? " is-done" : ""}${isDragging ? " is-dragging" : ""}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label={`拖动 Todo ${todo.title}`}
        className="secondary-action icon-only-action drag-handle todo-drag-handle"
        title="拖动 Todo"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <input
        aria-label={todo.title}
        checked={todo.status === "done"}
        className="todo-checkbox"
        type="checkbox"
        onChange={() => onToggleTodo(todo.id)}
      />
      <textarea
        aria-label={`编辑 ${todo.title}`}
        className="todo-title-input"
        ref={titleInputRef}
        rows={1}
        value={title}
        onBlur={saveTodoTitle}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleTodoTitleKeyDown}
      />
      <button className="text-action" type="button" aria-label={`删除 ${todo.title}`} onClick={() => onDeleteTodo(todo.id)}>
        <Trash2 size={15} />
        <span>删除</span>
      </button>
    </li>
  );
}
