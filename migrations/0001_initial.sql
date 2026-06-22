CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'history', 'deleted')),
  history_reason TEXT CHECK (history_reason IN ('completed', 'archived') OR history_reason IS NULL),
  sort_order REAL NOT NULL,
  last_active_sort_order REAL,
  auto_archive_suppressed_until_change INTEGER NOT NULL DEFAULT 0,
  ai_state TEXT NOT NULL DEFAULT 'idle' CHECK (ai_state IN ('idle', 'analyzing', 'done', 'failed', 'unavailable')),
  ai_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  history_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memo_todos (
  id TEXT PRIMARY KEY,
  memo_id TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo', 'done')),
  sort_order REAL NOT NULL,
  generated_by_ai INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  encrypted_api_key TEXT,
  api_key_mask TEXT,
  prompt_template TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS undo_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  id TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memos_user_status_sort ON memos(user_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_memos_history_at ON memos(user_id, status, history_at);
CREATE INDEX IF NOT EXISTS idx_todos_memo_sort ON memo_todos(memo_id, deleted_at, sort_order);
