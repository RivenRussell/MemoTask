ALTER TABLE memos ADD COLUMN ai_result_json TEXT;

ALTER TABLE memo_tags ADD COLUMN user_id TEXT;

UPDATE memo_tags
SET user_id = (
  SELECT memos.user_id
  FROM memos
  WHERE memos.id = memo_tags.memo_id
)
WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_memo_tags_user_normalized ON memo_tags(user_id, normalized_name);
