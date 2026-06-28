CREATE TABLE IF NOT EXISTS memo_tags (
  memo_id TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (memo_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_memo_tags_normalized ON memo_tags(normalized_name);
CREATE INDEX IF NOT EXISTS idx_memo_tags_memo_sort ON memo_tags(memo_id, sort_order);
