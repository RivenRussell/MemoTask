import type { MemoTodo, TodoStatus } from "../types";

export interface LinkedMarkdownTask {
  todoId: string;
  title: string;
  status: TodoStatus;
}

export interface TodoMarkdownSyncResult {
  todos: MemoTodo[];
  changed: boolean;
  titleChanged: boolean;
  statusChanged: boolean;
}

const linkedTaskLinePattern =
  /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s+)(.*?)(\s*<!--\s*memotask:todo=([A-Za-z0-9_-]+)\s*-->\s*)$/;

export function collectLinkedMarkdownTasks(content: string): LinkedMarkdownTask[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(linkedTaskLinePattern))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      todoId: match[6],
      title: match[4].trim(),
      status: match[2].toLowerCase() === "x" ? "done" : "todo"
    }));
}

export function syncMarkdownCheckboxForTodo(content: string, todoId: string, status: TodoStatus): string {
  const marker = status === "done" ? "x" : " ";
  return replaceLinkedTaskLine(content, todoId, (match) => `${match[1]}${marker}${match[3]}${match[4]}${match[5]}`);
}

export function syncMarkdownTaskTitleForTodo(content: string, todoId: string, title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return content;
  }

  return replaceLinkedTaskLine(content, todoId, (match) => `${match[1]}${match[2]}${match[3]}${trimmed}${match[5]}`);
}

export function syncTodosFromLinkedMarkdownTasks(todos: MemoTodo[], content: string, now: string): TodoMarkdownSyncResult {
  const linkedTasks = new Map(collectLinkedMarkdownTasks(content).map((task) => [task.todoId, task]));
  let titleChanged = false;
  let statusChanged = false;
  let changed = false;

  const nextTodos = todos.map((todo) => {
    if (todo.deletedAt !== null) {
      return todo;
    }

    const task = linkedTasks.get(todo.id);
    if (!task) {
      return todo;
    }

    const nextTitle = task.title || todo.title;
    const todoTitleChanged = nextTitle !== todo.title;
    const todoStatusChanged = task.status !== todo.status;

    if (!todoTitleChanged && !todoStatusChanged) {
      return todo;
    }

    changed = true;
    titleChanged ||= todoTitleChanged;
    statusChanged ||= todoStatusChanged;

    return {
      ...todo,
      title: nextTitle,
      status: task.status,
      updatedAt: now,
      completedAt: task.status === "done" ? (todo.status === "done" ? todo.completedAt : now) : null
    };
  });

  return {
    todos: changed ? nextTodos : todos,
    changed,
    titleChanged,
    statusChanged
  };
}

function replaceLinkedTaskLine(content: string, todoId: string, replacer: (match: RegExpMatchArray) => string): string {
  const lines = content.split(/\r?\n/);
  let changed = false;
  const nextLines = lines.map((line) => {
    const match = line.match(linkedTaskLinePattern);
    if (!match || match[6] !== todoId) {
      return line;
    }

    changed = true;
    return replacer(match);
  });

  return changed ? nextLines.join(content.includes("\r\n") ? "\r\n" : "\n") : content;
}
