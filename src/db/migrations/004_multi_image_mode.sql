ALTER TABLE user_settings
  ADD COLUMN multi_image_mode TEXT NOT NULL DEFAULT 'media_group'
  CHECK (multi_image_mode IN ('media_group', 'combine'));

ALTER TABLE chat_settings
  ADD COLUMN multi_image_mode TEXT NOT NULL DEFAULT 'media_group'
  CHECK (multi_image_mode IN ('media_group', 'combine'));
