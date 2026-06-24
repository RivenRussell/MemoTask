UPDATE ai_settings
SET base_url = '',
    model = '',
    encrypted_api_key = NULL,
    api_key_mask = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE user_id = 'default';
